import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import {
  LOG_ACTIVITY_KEY,
  LogActivityMeta,
} from '../decorators/log-activity.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Declarative replacement for the ~37 manual `logActivity(...)` calls the
 * old Server Actions made. Attach with `@LogActivity(meta)` + `@UseInterceptors(ActivityLogInterceptor)`
 * on any mutating route; it writes the entry after the handler succeeds.
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metaFn = this.reflector.get<LogActivityMeta>(
      LOG_ACTIVITY_KEY,
      context.getHandler(),
    );
    if (!metaFn) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = req.user;

    return next.handle().pipe(
      tap((result) => {
        if (!user) return;
        void this.write(metaFn, req, result, user);
      }),
    );
  }

  private async write(
    metaFn: LogActivityMeta,
    req: any,
    result: any,
    user: AuthenticatedUser,
  ) {
    try {
      const { action, details } = metaFn(req, result);
      await this.activityLogsService.create({
        userId: user.sub,
        userEmail: user.email,
        userName: user.name,
        action,
        details,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }
}
