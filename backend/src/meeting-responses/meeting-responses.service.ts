import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import {
  ClosedReason,
  departmentProgress,
  getResponseWindow,
  isBlankHtml,
  ResponseWindow,
  todayInTimeZone,
} from './meeting-responses.rules';
import { sanitizeConcern } from './sanitize-concern';
import type { UpsertMeetingResponseDto } from './dto/upsert-response.dto';

const VIEW_ALL = 'meeting-responses:view-all';

const meetingInclude = {
  oePlan: {
    include: { project: { include: { annualPlan: true } } },
  },
  department: { include: { businessUnit: true } },
  responses: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OpenMeetingInclude;

type MeetingRow = Prisma.OpenMeetingGetPayload<{
  include: typeof meetingInclude;
}>;
type ResponseRow = MeetingRow['responses'][number];

export interface Viewer {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
  businessUnitName: string | null;
  canViewAll: boolean;
}

const NO_DEPARTMENT_MESSAGE =
  'You are not registered in a department. Please contact an admin.';

const CLOSED_MESSAGES: Record<ClosedReason, string> = {
  MEETING_NOT_RELEASED: 'This Open Meeting has not been released yet.',
  PLAN_NOT_RELEASED:
    'The OE Plan for this meeting is not released (it may be closed).',
  ANNUAL_PLAN_NOT_APPROVED: 'The Annual Plan for this meeting is not approved.',
  MEETING_DATE_PASSED:
    'The meeting date has passed, so responses are read-only.',
};

@Injectable()
export class MeetingResponsesService {
  private readonly timeZone = process.env.APP_TIMEZONE ?? 'Asia/Phnom_Penh';

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsResolverService,
  ) {}

  /** Always read fresh from the DB: a moved or renamed user is seen as they are now. */
  async loadViewer(userId: string): Promise<Viewer> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: { include: { businessUnit: true } } },
    });
    if (!u) throw new ForbiddenException('User no longer exists');
    const granted = await this.permissions.getEffectivePermissions(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId,
      departmentName: u.department?.name ?? null,
      businessUnitName: u.department?.businessUnit?.name ?? null,
      canViewAll: granted.includes(VIEW_ALL),
    };
  }

  private windowFor(m: MeetingRow): ResponseWindow {
    return getResponseWindow({
      meetingStatus: m.status,
      meetingDate: m.actualVisitDate,
      planStatus: m.oePlan.status,
      annualPlanStatus: m.oePlan.project?.annualPlan?.status,
      today: todayInTimeZone(this.timeZone),
    });
  }

  private responseDto(r: ResponseRow, viewerId: string) {
    return {
      id: r.id,
      respondentName: r.respondentName,
      respondentEmail: r.respondentEmail,
      departmentName: r.departmentName,
      businessUnitName: r.businessUnitName,
      status: r.status,
      concern: r.concern,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      mine: r.userId === viewerId,
    };
  }

  private card(m: MeetingRow, viewerId: string) {
    const window = this.windowFor(m);
    const mine = m.responses.find((r) => r.userId === viewerId);
    return {
      id: m.id,
      // projectId/projectName/projectCode are the API's field names for backward
      // compatibility; they describe the parent Individual OE Plan, not a Project.
      projectId: m.oePlanId,
      projectName: m.oePlan.name,
      projectCode: m.oePlan.code,
      departmentId: m.departmentId,
      departmentName: m.department?.name ?? m.departments,
      businessUnitName: m.department?.businessUnit?.name ?? '',
      meetingDate: m.actualVisitDate,
      address: m.address,
      annualPlanId: m.oePlan.annualPlanId,
      window: {
        open: window.open,
        reason: window.reason,
        message: window.reason ? CLOSED_MESSAGES[window.reason] : undefined,
      },
      progress: departmentProgress(window, m.responses.length),
      responseCount: m.responses.length,
      revisionCount: m.responses.filter(
        (r) => r.status === 'REVISION_REQUESTED',
      ).length,
      myResponse: mine ? this.responseDto(mine, viewerId) : null,
    };
  }

  /**
   * What a scanned Annual Plan QR shows: the meetings for the scanner's own department
   * (or every meeting for leaders/admins). Only Approved plans have an active QR code.
   */
  async scan(userId: string, token: string) {
    const annualPlan = await this.prisma.annualPlan.findUnique({
      where: { qrToken: token },
    });
    if (!annualPlan || annualPlan.status !== 'APPROVED') {
      throw new NotFoundException('This QR code is not active.');
    }
    const viewer = await this.loadViewer(userId);
    const noDepartment = !viewer.canViewAll && !viewer.departmentId;

    const meetings = noDepartment
      ? []
      : await this.prisma.openMeeting.findMany({
          where: {
            isDeleted: false,
            status: 'RELEASED',
            oePlan: { annualPlanId: annualPlan.id },
            ...(viewer.canViewAll ? {} : { departmentId: viewer.departmentId }),
          },
          include: meetingInclude,
          orderBy: [{ actualVisitDate: 'asc' }, { createdAt: 'asc' }],
        });

    return {
      annualPlan: {
        id: annualPlan.id,
        planName: annualPlan.planName,
        period: annualPlan.period,
      },
      viewer: {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        role: viewer.role,
        departmentId: viewer.departmentId,
        departmentName: viewer.departmentName,
        businessUnitName: viewer.businessUnitName,
        canViewAll: viewer.canViewAll,
      },
      noDepartment,
      meetings: meetings.map((m) => this.card(m, viewer.id)),
    };
  }

  private async loadReleasedMeeting(meetingId: string): Promise<MeetingRow> {
    const m = await this.prisma.openMeeting.findUnique({
      where: { id: meetingId },
      include: meetingInclude,
    });
    if (!m || m.isDeleted || m.status !== 'RELEASED') {
      throw new NotFoundException('Open Meeting not found');
    }
    return m;
  }

  private assertCanView(viewer: Viewer, m: MeetingRow) {
    if (viewer.canViewAll) return;
    if (!viewer.departmentId) {
      throw new ForbiddenException(NO_DEPARTMENT_MESSAGE);
    }
    if (viewer.departmentId !== m.departmentId) {
      throw new ForbiddenException(
        'This meeting belongs to another department.',
      );
    }
  }

  async getMeeting(userId: string, meetingId: string) {
    const viewer = await this.loadViewer(userId);
    const m = await this.loadReleasedMeeting(meetingId);
    this.assertCanView(viewer, m);

    const memberCount = m.departmentId
      ? await this.prisma.user.count({
          where: { departmentId: m.departmentId },
        })
      : 0;

    return {
      ...this.card(m, viewer.id),
      standards: m.standards,
      leadExecution: m.leadExecution,
      teamMembers: m.teamMembers,
      objectives: m.objectives,
      scope: m.scope,
      scheduleRows: m.scheduleRows,
      memberCount,
      // Concerns are visible to the meeting's own department and to leaders/admins.
      responses: m.responses.map((r) => this.responseDto(r, viewer.id)),
      canRespond:
        this.windowFor(m).open && viewer.departmentId === m.departmentId,
    };
  }

  /** Create or update the caller's own response (one per user per meeting). */
  async upsertMine(
    userId: string,
    meetingId: string,
    dto: UpsertMeetingResponseDto,
  ) {
    const viewer = await this.loadViewer(userId);
    if (!viewer.departmentId) {
      throw new ForbiddenException(NO_DEPARTMENT_MESSAGE);
    }
    const m = await this.loadReleasedMeeting(meetingId);
    if (viewer.departmentId !== m.departmentId) {
      throw new ForbiddenException(
        'This meeting belongs to another department.',
      );
    }
    const window = this.windowFor(m);
    if (!window.open) {
      throw new BadRequestException(CLOSED_MESSAGES[window.reason!]);
    }

    const concern = sanitizeConcern(dto.concern ?? '');
    if (dto.status === 'REVISION_REQUESTED' && isBlankHtml(concern)) {
      throw new BadRequestException(
        'Please describe what should change when you request a revision.',
      );
    }

    // Identity and department are copied onto the response, so the record still reads
    // correctly if the user is later renamed, moved to another department or deleted.
    const snapshot = {
      respondentName: viewer.name,
      respondentEmail: viewer.email,
      departmentId: viewer.departmentId,
      departmentName: viewer.departmentName ?? '',
      businessUnitName: viewer.businessUnitName ?? '',
      status: dto.status,
      concern: isBlankHtml(concern) ? '' : concern,
    };
    const saved = await this.prisma.meetingResponse.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, ...snapshot },
      update: snapshot,
    });
    return this.responseDto(saved, viewer.id);
  }

  /** Leader/admin roll-up: every released meeting with its department's progress. */
  async rollup(annualPlanId?: string) {
    const meetings = await this.prisma.openMeeting.findMany({
      where: {
        isDeleted: false,
        status: 'RELEASED',
        ...(annualPlanId ? { oePlan: { annualPlanId } } : {}),
      },
      include: meetingInclude,
      orderBy: [{ actualVisitDate: 'asc' }, { createdAt: 'asc' }],
    });
    const counts = await this.prisma.user.groupBy({
      by: ['departmentId'],
      _count: { _all: true },
    });
    const memberCounts = new Map(
      counts.map((c) => [c.departmentId, c._count._all]),
    );

    const rows = meetings.map((m) => ({
      ...this.card(m, ''),
      memberCount: m.departmentId ? (memberCounts.get(m.departmentId) ?? 0) : 0,
      responses: m.responses.map((r) => this.responseDto(r, '')),
    }));
    return {
      summary: {
        total: rows.length,
        done: rows.filter((r) => r.progress === 'DONE').length,
        missed: rows.filter((r) => r.progress === 'MISSED').length,
        open: rows.filter((r) => r.window.open).length,
        withRevisionRequests: rows.filter((r) => r.revisionCount > 0).length,
      },
      meetings: rows,
    };
  }
}
