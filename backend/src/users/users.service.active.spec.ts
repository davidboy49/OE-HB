/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService(opts: { target: unknown; otherActiveAdmins?: number }) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.target),
      count: jest.fn().mockResolvedValue(opts.otherActiveAdmins ?? 0),
      update: jest.fn().mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({
          id: 'u1',
          email: 'a@b.c',
          name: 'A',
          role: 'ADMIN',
          departmentId: null,
          groupId: null,
          keycloakSub: null,
          isActive: true,
          ...data,
        }),
      ),
    },
  } as unknown as PrismaService;
  return { service: new UsersService(prisma), prisma };
}

const user = (over: object = {}) => ({
  id: 'u1',
  role: 'OE_MEMBER',
  isActive: true,
  ...over,
});

describe('UsersService.setActive', () => {
  it('deactivates and reactivates an ordinary account', async () => {
    const { service, prisma } = makeService({ target: user() });
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

  it('will not deactivate the last active admin', async () => {
    const { service, prisma } = makeService({
      target: user({ role: 'ADMIN' }),
      otherActiveAdmins: 0,
    });
    await expect(service.setActive('u1', false)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('deactivates an admin when another active admin remains', async () => {
    const { service } = makeService({
      target: user({ role: 'ADMIN' }),
      otherActiveAdmins: 1,
    });
    await expect(service.setActive('u1', false)).resolves.toMatchObject({
      isActive: false,
    });
  });
});
