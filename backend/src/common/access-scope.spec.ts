import {
  ViewerContext,
  annualPlanWhere,
  departmentInScope,
  findingWhere,
  meetingWhere,
  oePlanWhere,
  plannedEngagementWhere,
  scheduleWhere,
} from './access-scope';

const inDept: ViewerContext = {
  id: 'u1',
  name: 'Dara',
  departmentId: 'dept-fin',
  businessUnitId: 'bu-corp',
};
const noDept: ViewerContext = {
  id: 'u2',
  name: 'Sok',
  departmentId: null,
  businessUnitId: null,
};

const NOTHING = { id: { in: [] } };

describe('plannedEngagementWhere', () => {
  it('ALL reaches every project', () => {
    expect(plannedEngagementWhere('ALL', inDept)).toEqual({});
  });

  it("DEPARTMENT reaches only the viewer's own department", () => {
    expect(plannedEngagementWhere('DEPARTMENT', inDept)).toEqual({
      departmentId: 'dept-fin',
    });
  });

  it("BU reaches every department of the viewer's Business Unit", () => {
    expect(plannedEngagementWhere('BU', inDept)).toEqual({
      department: { businessUnitId: 'bu-corp' },
    });
  });

  it('a viewer with no department sees nothing when scoped to it (never everything)', () => {
    expect(plannedEngagementWhere('DEPARTMENT', noDept)).toEqual(NOTHING);
    expect(plannedEngagementWhere('BU', noDept)).toEqual(NOTHING);
  });

  it('MEMBER is not a Project scope and sees nothing', () => {
    expect(plannedEngagementWhere('MEMBER', inDept)).toEqual(NOTHING);
  });
});

describe('oePlanWhere', () => {
  it("follows the Project's department / Business Unit", () => {
    expect(oePlanWhere('DEPARTMENT', inDept)).toEqual({
      plannedEngagement: { departmentId: 'dept-fin' },
    });
    expect(oePlanWhere('BU', inDept)).toEqual({
      plannedEngagement: { department: { businessUnitId: 'bu-corp' } },
    });
  });

  it('MEMBER matches the plans the viewer leads or is a member of', () => {
    expect(oePlanWhere('MEMBER', inDept)).toEqual({
      OR: [
        { leaderId: 'u1' },
        { leaderId: 'Dara' },
        { members: { some: { id: 'u1' } } },
      ],
    });
  });

  it('a viewer with no department sees nothing when scoped to it', () => {
    expect(oePlanWhere('DEPARTMENT', noDept)).toEqual(NOTHING);
    expect(oePlanWhere('BU', noDept)).toEqual(NOTHING);
  });
});

describe('annualPlanWhere', () => {
  it('ALL reaches every plan', () => {
    expect(annualPlanWhere('ALL', inDept)).toEqual({});
  });

  it('a scoped viewer sees plans that hold one of their projects, or that they created', () => {
    expect(annualPlanWhere('DEPARTMENT', inDept)).toEqual({
      OR: [
        { createdBy: 'Dara' },
        { plannedEngagements: { some: { departmentId: 'dept-fin' } } },
      ],
    });
  });

  it('a department-less viewer sees only the plans they created', () => {
    expect(annualPlanWhere('DEPARTMENT', noDept)).toEqual({
      OR: [{ createdBy: 'Sok' }, { plannedEngagements: { some: NOTHING } }],
    });
  });
});

describe('records that hang off an OE Plan', () => {
  it('ALL is unfiltered', () => {
    expect(meetingWhere('ALL', inDept)).toEqual({});
    expect(scheduleWhere('ALL', inDept)).toEqual({});
    expect(findingWhere('ALL', inDept)).toEqual({});
  });

  it('a narrower scope is applied through the parent OE Plan', () => {
    const plan = oePlanWhere('DEPARTMENT', inDept);
    expect(meetingWhere('DEPARTMENT', inDept)).toEqual({ project: plan });
    expect(scheduleWhere('DEPARTMENT', inDept)).toEqual({ project: plan });
    expect(findingWhere('DEPARTMENT', inDept)).toEqual({
      executionSchedule: { project: plan },
    });
  });
});

describe('departmentInScope', () => {
  const finance = { id: 'dept-fin', businessUnitId: 'bu-corp' };
  const sameBu = { id: 'dept-hr', businessUnitId: 'bu-corp' };
  const other = { id: 'dept-ops', businessUnitId: 'bu-ops' };

  it('ALL allows any department', () => {
    expect(departmentInScope('ALL', inDept, other)).toBe(true);
  });

  it("DEPARTMENT allows only the viewer's own", () => {
    expect(departmentInScope('DEPARTMENT', inDept, finance)).toBe(true);
    expect(departmentInScope('DEPARTMENT', inDept, sameBu)).toBe(false);
    expect(departmentInScope('DEPARTMENT', noDept, finance)).toBe(false);
  });

  it("BU allows any department of the viewer's Business Unit", () => {
    expect(departmentInScope('BU', inDept, sameBu)).toBe(true);
    expect(departmentInScope('BU', inDept, other)).toBe(false);
    expect(departmentInScope('BU', noDept, sameBu)).toBe(false);
  });

  it('MEMBER never allows filing a Project', () => {
    expect(departmentInScope('MEMBER', inDept, finance)).toBe(false);
  });
});
