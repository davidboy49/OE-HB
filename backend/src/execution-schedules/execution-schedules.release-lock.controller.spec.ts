/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { ExecutionSchedulesController } from './execution-schedules.controller';
import type { ExecutionSchedulesService } from './execution-schedules.service';
import type { AccessScopeService } from '../common/access-scope.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';

const user = {
  sub: 'u1',
  email: 'editor@example.com',
  name: 'Schedule Editor',
  departmentId: null,
};

function makeController(status: string, language = 'English') {
  const service = {
    findOne: jest.fn().mockResolvedValue({
      id: 's1',
      status,
      language,
      scheduleRows: '[]',
    }),
    update: jest.fn().mockResolvedValue({ id: 's1' }),
  } as unknown as ExecutionSchedulesService;
  const accessScope = {
    assertVisible: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessScopeService;
  const permissionsResolver = {
    requirePermission: jest.fn().mockResolvedValue(undefined),
  } as unknown as PermissionsResolverService;

  return {
    controller: new ExecutionSchedulesController(
      service,
      accessScope,
      permissionsResolver,
    ),
    service,
    permissionsResolver,
  };
}

describe('ExecutionSchedulesController.update - released schedule lock', () => {
  it('rejects field edits on a released schedule', async () => {
    const { controller, service } = makeController('RELEASED');

    await expect(
      controller.update('s1', { address: 'Changed' }, {} as Request, user),
    ).rejects.toThrow(BadRequestException);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('rejects a "reopen" that smuggles in other field changes', async () => {
    const { controller, service } = makeController('RELEASED');

    await expect(
      controller.update(
        's1',
        { status: 'DRAFT', scheduleRows: '[]' },
        {} as Request,
        user,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('allows a bare reopen, gated on execution-schedules:reopen', async () => {
    const { controller, service, permissionsResolver } =
      makeController('RELEASED');

    await controller.update(
      's1',
      { status: 'DRAFT', lastModifiedBy: 'x' },
      {} as Request,
      user,
    );

    expect(permissionsResolver.requirePermission).toHaveBeenCalledWith(
      user,
      'execution-schedules:reopen',
    );
    expect(service.update).toHaveBeenCalled();
  });

  it('does not lock draft schedules', async () => {
    const { controller, service, permissionsResolver } =
      makeController('DRAFT');

    await controller.update('s1', { address: 'Changed' }, {} as Request, user);

    expect(permissionsResolver.requirePermission).not.toHaveBeenCalled();
    expect(service.update).toHaveBeenCalled();
  });

  it('does not lock released findings reports, which are still worked after release', async () => {
    const { controller, service } = makeController('RELEASED', 'finding');

    await controller.update(
      's1',
      { scheduleRows: '[]' },
      {} as Request,
      user,
    );

    expect(service.update).toHaveBeenCalled();
  });
});
