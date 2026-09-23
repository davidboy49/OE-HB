/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';

function makeService(opts: { target: unknown; managerIds?: string[] }) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.target),
      update: jest.fn().mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({
          id: 'u1',
          email: 'a@b.c',
          name: 'A',
          departmentId: null,
          groupId: null,
          keycloakSub: null,
          isActive: true,
          ...data,
        }),
      ),
    },
  } as unknown as PrismaService;
  const permissionsResolver = {
    getActiveUserIdsWithPermission: jest
      .fn()
      .mockResolvedValue(opts.managerIds ?? []),
  } as unknown as PermissionsResolverService;
  return {
    service: new UsersService(prisma, permissionsResolver),
    prisma,
    permissionsResolver,
  };
}

const user = (over: object = {}) => ({
  id: 'u1',
  isActive: true,
  ...over,
});

describe('UsersService.setActive', () => {
  it('deactivates and reactivates an ordinary account', async () => {
    const { service, prisma } = makeService({
      target: user(),
      managerIds: ['someone-else'],
    });
    await expect(service.setActive('u1', false)).resolves.toMatchObject({
      isActive: false,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: false },
    });
  });

  it('404s for an unknown account', async () => {
    const { service } = makeService({ target: null });
    await expect(service.setActive('nope', false)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('will not deactivate the last active user who can manage users', async () => {
    const { service, prisma } = makeService({
      target: user(),
      managerIds: ['u1'],
    });
    await expect(service.setActive('u1', false)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('deactivates a manager when another active manager remains', async () => {
    const { service } = makeService({
      target: user(),
      managerIds: ['u1', 'u2'],
    });
    await expect(service.setActive('u1', false)).resolves.toMatchObject({
      isActive: false,
    });
  });

  it('deactivating someone who is not a manager never checks the manager count', async () => {
    const { service } = makeService({
      target: user(),
      managerIds: ['someone-else'],
    });
    await expect(service.setActive('u1', false)).resolves.toMatchObject({
      isActive: false,
    });
  });
});
