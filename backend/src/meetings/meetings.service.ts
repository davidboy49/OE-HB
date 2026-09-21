import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { assertProjectReleased } from '../common/assert-project-status';

export interface CreateOpenMeetingInput {
  projectId: string;
  departments: string;
  address: string;
  visitNumber: string;
  actualVisitDate: string;
  oePeriod: string;
  leadExecution: string;
  teamMembers: string;
  additionalAttendees?: string;
  attendeeConfirmations?: string;
  standards: string;
  status?: string;
  objectives: string;
  scope: string;
  scheduleRows: string;
  ownerName?: string;
  lastModifiedBy?: string;
}

export interface UpdateOpenMeetingInput {
  departments?: string;
  address?: string;
  visitNumber?: string;
  actualVisitDate?: string;
  oePeriod?: string;
  leadExecution?: string;
  teamMembers?: string;
  additionalAttendees?: string;
  attendeeConfirmations?: string;
  standards?: string;
  status?: string;
  objectives?: string;
  scope?: string;
  scheduleRows?: string;
  ownerName?: string;
  lastModifiedBy?: string;
}

/**
 * Port of the OpenMeeting + QR consent slice of frontend/src/lib/dbService.ts
 * (lines 925-1337) + frontend/src/app/actions.ts (lines 382-409, 823-847).
 */
/**
 * Open Meeting approval flow. A submitted meeting has to be approved (released) by
 * someone holding meetings:approve - an OE Leader - before it counts; nothing can
 * jump straight to RELEASED. Any content edit puts the meeting back to DRAFT.
 */
export const ALLOWED_MEETING_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED_FOR_APPROVAL'],
  SUBMITTED_FOR_APPROVAL: ['RELEASED', 'DRAFT'],
  RELEASED: ['DRAFT'],
};

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(m: any): any {
    return {
      id: m.id,
      projectId: m.projectId,
      projectName: m.project?.name,
      projectCode: m.project?.code,
      departmentId: m.departmentId,
      departments: m.departments,
      address: m.address,
      visitNumber: m.visitNumber,
      actualVisitDate: m.actualVisitDate,
      oePeriod: m.oePeriod,
      leadExecution: m.leadExecution,
      teamMembers: m.teamMembers,
      additionalAttendees: m.additionalAttendees,
      attendeeConfirmations: m.attendeeConfirmations,
      standards: m.standards,
      status: m.status,
      objectives: m.objectives,
      scope: m.scope,
      scheduleRows: m.scheduleRows,
      ownerName: m.ownerName,
      lastModifiedBy: m.lastModifiedBy,
      isDeleted: m.isDeleted,
      createdAt:
        m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
      updatedAt:
        m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
    };
  }

  /** `visibleTo` is the caller's view scope (see AccessScopeService). */
  async findAll(visibleTo: Prisma.OpenMeetingWhereInput = {}): Promise<any[]> {
    const meetings = await this.prisma.openMeeting.findMany({
      where: { isDeleted: false, ...visibleTo },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
    return meetings.map((m) => this.toDto(m));
  }

  async findByProject(
    projectId: string,
    visibleTo: Prisma.OpenMeetingWhereInput = {},
  ): Promise<any[]> {
    const meetings = await this.prisma.openMeeting.findMany({
      where: { projectId, isDeleted: false, ...visibleTo },
      include: { project: true },
      orderBy: { createdAt: 'asc' },
    });
    return meetings.map((m) => this.toDto(m));
  }

  async findOne(id: string): Promise<any | null> {
    const m = await this.prisma.openMeeting.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!m || m.isDeleted) return null;
    return this.toDto(m);
  }

  /** The owner is always the authenticated creator (actorName), never a client-supplied value. */
  async create(data: CreateOpenMeetingInput, actorName: string): Promise<any> {
    await assertProjectReleased(this.prisma, data.projectId);
    // The department is fixed by the project (one project = one department), never
    // taken from the client.
    const project = await this.prisma.oePlan.findUnique({
      where: { id: data.projectId },
      include: { plannedEngagement: true },
    });
    const m = await this.prisma.openMeeting.create({
      data: {
        projectId: data.projectId,
        departmentId: project?.plannedEngagement?.departmentId ?? null,
        departments: project?.plannedEngagement?.topic ?? data.departments,
        address: data.address,
        visitNumber: data.visitNumber,
        actualVisitDate: data.actualVisitDate,
        oePeriod: data.oePeriod,
        leadExecution: data.leadExecution,
        teamMembers: data.teamMembers,
        additionalAttendees: data.additionalAttendees || '',
        attendeeConfirmations: data.attendeeConfirmations || '{}',
        standards: data.standards,
        // Always DRAFT: status only moves through updateStatus (submit -> approve).
        status: 'DRAFT',
        objectives: data.objectives,
        scope: data.scope,
        scheduleRows: data.scheduleRows,
        ownerName: actorName,
        lastModifiedBy: actorName,
      },
      include: { project: true },
    });
    return this.findOne(m.id);
  }

  /** ownerName is set once at creation and never changes; lastModifiedBy is the authenticated editor. */
  async update(
    id: string,
    data: UpdateOpenMeetingInput,
    actorName: string,
  ): Promise<any> {
    const updateData: Prisma.OpenMeetingUpdateInput = {
      address: data.address,
      visitNumber: data.visitNumber,
      actualVisitDate: data.actualVisitDate,
      oePeriod: data.oePeriod,
      leadExecution: data.leadExecution,
      teamMembers: data.teamMembers,
      additionalAttendees: data.additionalAttendees,
      attendeeConfirmations: data.attendeeConfirmations,
      standards: data.standards,
      // An edit always sends the meeting back to DRAFT so it must be submitted and
      // approved again; a client-supplied status is never trusted.
      status: 'DRAFT',
      objectives: data.objectives,
      scope: data.scope,
      scheduleRows: data.scheduleRows,
      lastModifiedBy: actorName,
    };

    const m = await this.prisma.openMeeting.update({
      where: { id },
      data: updateData,
      include: { project: true },
    });
    return this.findOne(m.id);
  }

  /** DRAFT -> SUBMITTED_FOR_APPROVAL -> RELEASED, with reject/reopen looping back to DRAFT. */
  async updateStatus(id: string, status: string): Promise<any> {
    const current = await this.prisma.openMeeting.findUnique({ where: { id } });
    if (!current || current.isDeleted) {
      throw new NotFoundException('Open Meeting not found');
    }
    if (!ALLOWED_MEETING_STATUS_TRANSITIONS[current.status]?.includes(status)) {
      throw new BadRequestException(
        `An Open Meeting cannot move from ${current.status} to ${status}. It must be submitted for approval, then approved by an OE Leader.`,
      );
    }
    await this.prisma.openMeeting.update({
      where: { id },
      data: { status },
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.openMeeting.update({
      where: { id },
      data: { isDeleted: true },
    });
    return true;
  }
}
