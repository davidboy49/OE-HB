import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsResolverService } from './permissions-resolver.service';
import type { AccessScope } from './permissions';
import {
  ViewerContext,
  annualPlanWhere,
  departmentInScope,
  findingWhere,
  meetingWhere,
  oePlanWhere,
  projectWhere,
  scheduleWhere,
} from './access-scope';

/** The record types that carry a scope, and the view permission that governs each. */
export type ScopedKind =
  'annualPlan' | 'project' | 'oePlan' | 'meeting' | 'schedule' | 'finding';

const VIEW_KEY: Record<ScopedKind, string> = {
  annualPlan: 'annual-plans:view',
  project: 'projects:view',
  oePlan: 'oe-plans:view',
  meeting: 'meetings:view',
  schedule: 'execution-schedules:view',
  finding: 'findings:view',
};

/**
 * What an OE Plan listing may include. An OE Plan carries its schedules, meetings and findings,
 * so each nested list follows ITS OWN module's view permission and scope; `null` = the viewer
 * holds no view permission for it and must get nothing.
 */
export interface OePlanReadScope {
  plans: Prisma.OePlanWhereInput;
  schedules: Prisma.ExecutionScheduleWhereInput | null;
  meetings: Prisma.OpenMeetingWhereInput | null;
  findings: Prisma.FindingWhereInput | null;
}

/**
 * Answers "which records may this user see?" from their grant's scope. Services put the
 * returned filter in their queries, so a list never contains - and a direct link never
 * reveals - a record outside the user's reach.
 */
@Injectable()
export class AccessScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsResolverService,
  ) {}

  /** The viewer as they are NOW (fresh from the database, never from the token). */
  async context(userId: string): Promise<ViewerContext> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        departmentId: true,
        department: { select: { businessUnitId: true } },
      },
    });
    if (!u) throw new ForbiddenException('User no longer exists');
    return {
      id: u.id,
      name: u.name,
      departmentId: u.departmentId,
      businessUnitId: u.department?.businessUnitId ?? null,
    };
  }

  private async scopeOf(
    userId: string,
    kind: ScopedKind,
  ): Promise<AccessScope> {
    const grants = await this.permissions.getGrants(userId);
    const scope = grants[VIEW_KEY[kind]];
    if (!scope) throw new ForbiddenException('Access Denied');
    return scope;
  }

  async oePlanReadScope(userId: string): Promise<OePlanReadScope> {
    const grants = await this.permissions.getGrants(userId);
    const plan = grants['oe-plans:view'];
    if (!plan) throw new ForbiddenException('Access Denied');
    const ctx = await this.context(userId);
    const sched = grants['execution-schedules:view'];
    const meet = grants['meetings:view'];
    const find = grants['findings:view'];
    return {
      plans: oePlanWhere(plan, ctx),
      schedules: sched ? scheduleWhere(sched, ctx) : null,
      meetings: meet ? meetingWhere(meet, ctx) : null,
      findings: find ? findingWhere(find, ctx) : null,
    };
  }

  async annualPlans(userId: string): Promise<Prisma.AnnualPlanWhereInput> {
    return annualPlanWhere(
      await this.scopeOf(userId, 'annualPlan'),
      await this.context(userId),
    );
  }

  async projects(userId: string): Promise<Prisma.ProjectWhereInput> {
    return projectWhere(
      await this.scopeOf(userId, 'project'),
      await this.context(userId),
    );
  }

  async oePlans(userId: string): Promise<Prisma.OePlanWhereInput> {
    return oePlanWhere(
      await this.scopeOf(userId, 'oePlan'),
      await this.context(userId),
    );
  }

  async meetings(userId: string): Promise<Prisma.OpenMeetingWhereInput> {
    return meetingWhere(
      await this.scopeOf(userId, 'meeting'),
      await this.context(userId),
    );
  }

  async schedules(userId: string): Promise<Prisma.ExecutionScheduleWhereInput> {
    return scheduleWhere(
      await this.scopeOf(userId, 'schedule'),
      await this.context(userId),
    );
  }

  async findings(userId: string): Promise<Prisma.FindingWhereInput> {
    return findingWhere(
      await this.scopeOf(userId, 'finding'),
      await this.context(userId),
    );
  }

  /**
   * Refuses unless a Project of this department is inside the caller's Projects scope - so a
   * department user cannot file a Project under another department.
   */
  async assertDepartmentInScope(
    departmentId: string,
    userId: string,
  ): Promise<void> {
    const scope = await this.scopeOf(userId, 'project');
    if (scope === 'ALL') return;
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, businessUnitId: true },
    });
    if (!dept) return; // the service reports an unknown department itself
    if (!departmentInScope(scope, await this.context(userId), dept)) {
      throw new ForbiddenException(
        'That department is outside the area you may plan for.',
      );
    }
  }

  /**
   * Refuses (404 - the record's existence is not revealed) unless the record is inside the
   * caller's view scope. Called before any write to an existing record, so you cannot change
   * what you cannot see.
   */
  async assertVisible(
    kind: ScopedKind,
    id: string | null | undefined,
    userId: string,
  ): Promise<void> {
    if (!id) return;
    const scope = await this.scopeOf(userId, kind);
    if (scope === 'ALL') return;
    const ctx = await this.context(userId);

    let visible = 0;
    switch (kind) {
      case 'annualPlan':
        visible = await this.prisma.annualPlan.count({
          where: { id, ...annualPlanWhere(scope, ctx) },
        });
        break;
      case 'project':
        visible = await this.prisma.project.count({
          where: { id, ...projectWhere(scope, ctx) },
        });
        break;
      case 'oePlan':
        visible = await this.prisma.oePlan.count({
          where: { id, ...oePlanWhere(scope, ctx) },
        });
        break;
      case 'meeting':
        visible = await this.prisma.openMeeting.count({
          where: { id, ...meetingWhere(scope, ctx) },
        });
        break;
      case 'schedule':
        visible = await this.prisma.executionSchedule.count({
          where: { id, ...scheduleWhere(scope, ctx) },
        });
        break;
      case 'finding':
        visible = await this.prisma.finding.count({
          where: { id, ...findingWhere(scope, ctx) },
        });
        break;
    }
    if (visible === 0) throw new NotFoundException('Not found');
  }
}
