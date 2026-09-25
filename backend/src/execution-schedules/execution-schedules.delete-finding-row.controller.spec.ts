/* eslint-disable @typescript-eslint/unbound-method */
import type { Request } from 'express';
import { ExecutionSchedulesController } from './execution-schedules.controller';
import type { ExecutionSchedulesService } from './execution-schedules.service';
import type { AccessScopeService } from '../common/access-scope.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';

const user = {
  sub: 'u1',
  email: 'editor@example.com',
  name: 'Finding Editor',
  departmentId: null,
};

function makeController(language = 'finding') {
  const service = {
    findOne: jest.fn().mockResolvedValue({
      id: 's1',
      language,
      scheduleRows: JSON.stringify([{ id: 'r1' }, { id: 'r2' }]),
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
    permissionsResolver,
  };
}

describe('ExecutionSchedulesController.update - deleting finding rows', () => {
  it('requires the dedicated permission when a findings report loses a row', async () => {
    const { controller, permissionsResolver } = makeController();

    await controller.update(
      's1',
      { scheduleRows: JSON.stringify([{ id: 'r1' }]) },
      {} as Request,
      user,
    );

    expect(permissionsResolver.requirePermission).toHaveBeenCalledWith(
      user,
      'execution-schedules:delete-finding-row',
    );
  });

  it('does not require delete permission when the row count stays the same', async () => {
    const { controller, permissionsResolver } = makeController();

    await controller.update(
      's1',
      {
        scheduleRows: JSON.stringify([
          { id: 'r1', activity: 'Edited' },
          { id: 'r2' },
        ]),
      },
      {} as Request,
      user,
    );

    expect(permissionsResolver.requirePermission).not.toHaveBeenCalled();
  });

  it('does not apply the findings-only permission to ordinary schedule slots', async () => {
    const { controller, permissionsResolver } = makeController('en');

    await controller.update(
      's1',
      { scheduleRows: JSON.stringify([{ id: 'r1' }]) },
      {} as Request,
      user,
    );

    expect(permissionsResolver.requirePermission).not.toHaveBeenCalled();
  });
});
