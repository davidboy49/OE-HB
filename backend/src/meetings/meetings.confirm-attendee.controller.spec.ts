/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import type { MeetingsService } from './meetings.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';
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
    confirmAttendee: jest.fn().mockResolvedValue({ id: 'm1' }),
  } as unknown as MeetingsService;
  const accessScope = {
    assertVisible: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessScopeService;
  return {
    controller: new MeetingsController(
      service,
      {} as PermissionsResolverService,
      accessScope,
    ),
    service,
  };
}

describe('MeetingsController.confirmAttendee - who may confirm', () => {
  it('lets a member confirm their own attendance', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.confirmAttendee('m1', { attendeeName: 'Dara' }, member),
    ).resolves.toEqual({ id: 'm1' });
    expect(service.confirmAttendee).toHaveBeenCalledWith('m1', 'Dara', 'Dara');
  });

  it('refuses a member confirming someone else', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.confirmAttendee(
        'm1',
        { attendeeName: 'Someone Else' },
        member,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(service.confirmAttendee).not.toHaveBeenCalled();
  });

  it('lets an ADMIN confirm on behalf of anyone', async () => {
    const { controller } = makeController();
    await expect(
      controller.confirmAttendee('m1', { attendeeName: 'Someone Else' }, admin),
    ).resolves.toBeDefined();
  });
});
