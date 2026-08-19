import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const LOG_ACTIVITY_KEY = 'logActivity';

/**
 * Builds the action/details strings for the activity log from the raw Express
 * request (body/params/query) and the handler's return value.
 */
export type LogActivityMeta = (
  req: Request,
  result: any,
) => { action: string; details: string };

/** Declaratively logs an activity-log entry after a mutating route succeeds. */
export const LogActivity = (meta: LogActivityMeta) =>
  SetMetadata(LOG_ACTIVITY_KEY, meta);
