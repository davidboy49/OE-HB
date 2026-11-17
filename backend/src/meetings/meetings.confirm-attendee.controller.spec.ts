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
  departmentId: null,
};
const confirmer = {
  ...member,
  sub: 'u2',
  name: 'Confirmer User',
};

function makeController(opts: { granted?: string[] } = {}) {
  const service = {
    confirmAttendee: jest.fn().mockResolvedValue({ id: 'm1' }),
  } as unknown as MeetingsService;
  const accessScope = {
    assertVisible: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessScopeService;
  const permissionsResolver = {
    getEffectivePermissions: jest.fn().mockResolvedValue(opts.granted ?? []),
  } as unknown as PermissionsResolverService;
  return {
    controller: new MeetingsController(
      service,
      permissionsResolver,
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

  it('lets a user holding meetings:confirm-others confirm on behalf of anyone', async () => {
    const { controller } = makeController({
      granted: ['meetings:confirm-others'],
    });
    await expect(
      controller.confirmAttendee(
        'm1',
        { attendeeName: 'Someone Else' },
        confirmer,
      ),
    ).resolves.toBeDefined();
  });
});
