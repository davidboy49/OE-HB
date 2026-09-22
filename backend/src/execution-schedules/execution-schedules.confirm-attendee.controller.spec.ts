/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { ExecutionSchedulesController } from './execution-schedules.controller';
import type { ExecutionSchedulesService } from './execution-schedules.service';
import type { AccessScopeService } from '../common/access-scope.service';

const member = {
  sub: 'u1',
  email: 'a@b.c',
  name: 'Dara',
  role: 'OE_MEMBER' as const,
  departmentId: null,
};
const admin = {
  ...member,
  sub: 'u2',
  name: 'Admin User',
  role: 'ADMIN' as const,
};

function makeController() {
  const service = {
    confirmAttendee: jest.fn().mockResolvedValue({ id: 's1' }),
  } as unknown as ExecutionSchedulesService;
  const accessScope = {
    assertVisible: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessScopeService;
  return {
    controller: new ExecutionSchedulesController(service, accessScope),
    service,
  };
}

describe('ExecutionSchedulesController.confirmAttendee - who may confirm', () => {
  it('lets a member confirm their own attendance', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.confirmAttendee('s1', { attendeeName: 'Dara' }, member),
    ).resolves.toEqual({ id: 's1' });
    expect(service.confirmAttendee).toHaveBeenCalledWith('s1', 'Dara', 'Dara');
  });

  it("is case/whitespace tolerant when matching the caller's own name", async () => {
    const { controller } = makeController();
    await expect(
      controller.confirmAttendee('s1', { attendeeName: '  dara  ' }, member),
    ).resolves.toBeDefined();
  });

  it('refuses a member confirming someone else', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.confirmAttendee(
        's1',
        { attendeeName: 'Someone Else' },
        member,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(service.confirmAttendee).not.toHaveBeenCalled();
  });

  it('lets an ADMIN confirm on behalf of anyone', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.confirmAttendee('s1', { attendeeName: 'Someone Else' }, admin),
    ).resolves.toBeDefined();
    expect(service.confirmAttendee).toHaveBeenCalledWith(
      's1',
      'Someone Else',
      'Admin User',
    );
  });
});
