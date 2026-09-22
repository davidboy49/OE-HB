import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_SCOPES,
  AccessScope,
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  scopesFor,
} from '../common/permissions';

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  keycloakGroup: string | null;
  memberCount: number;
  permissionCount: number;
}

export interface GrantView {
  key: string;
  scope: AccessScope;
}

export interface GrantChange {
  grants: GrantView[];
  granted: string[];
  revoked: string[];
  scopeChanged: string[];
}

/** How wide a scope is: a grant may only be handed on at the same width or narrower. */
export const SCOPE_RANK: Record<AccessScope, number> = {
  ALL: 4,
  BU: 3,
  DEPARTMENT: 2,
  MEMBER: 2,
};

const COUNTS = { _count: { select: { users: true, grants: true } } } as const;

/** Blank input clears the mapping (stored as null, matching the unique nullable column). */
const normaliseKeycloakGroup = (v: string | null | undefined): string | null =>
  v?.trim() ? v.trim() : null;

const toSummary = (g: {
  id: string;
  name: string;
  description: string | null;
  keycloakGroup: string | null;
  _count: { users: number; grants: number };
}): GroupSummary => ({
  id: g.id,
  name: g.name,
  description: g.description,
  keycloakGroup: g.keycloakGroup,
  memberCount: g._count.users,
  permissionCount: g._count.grants,
});

@Injectable()
export class UserGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<GroupSummary[]> {
    const groups = await this.prisma.userGroup.findMany({
      orderBy: { name: 'asc' },
      include: COUNTS,
    });
    return groups.map(toSummary);
  }

  private async getSummary(id: string): Promise<GroupSummary> {
    const g = await this.prisma.userGroup.findUnique({
      where: { id },
      include: COUNTS,
    });
    if (!g) throw new NotFoundException('User group not found');
    return toSummary(g);
  }

  async create(
    name: string,
    description: string,
    keycloakGroup?: string | null,
  ): Promise<GroupSummary> {
    try {
      const g = await this.prisma.userGroup.create({
        data: {
          name: name.trim(),
          description,
          keycloakGroup: normaliseKeycloakGroup(keycloakGroup),
        },
        include: COUNTS,
      });
      return toSummary(g);
    } catch (e) {
      throw this.translate(e);
    }
  }

  async update(
    id: string,
    name: string,
    description: string,
    keycloakGroup?: string | null,
  ): Promise<GroupSummary> {
    try {
      const g = await this.prisma.userGroup.update({
        where: { id },
        data: {
          name: name.trim(),
          description,
          keycloakGroup: normaliseKeycloakGroup(keycloakGroup),
        },
        include: COUNTS,
      });
      return toSummary(g);
    } catch (e) {
      throw this.translate(e);
    }
  }

  /** Members of the group are left with no group - and so no permissions at all - until reassigned. */
  async remove(id: string): Promise<boolean> {
    await this.getSummary(id);
    await this.prisma.userGroup.delete({ where: { id } });
    return true;
  }

  /** Copy a group with all of its grants (and their scopes) under a new name. */
  async clone(id: string, name: string): Promise<GroupSummary> {
    const source = await this.prisma.userGroup.findUnique({
      where: { id },
      include: { grants: true },
    });
    if (!source) throw new NotFoundException('User group not found');
    try {
      const copy = await this.prisma.userGroup.create({
        data: {
          name: name.trim(),
          description: source.description,
          grants: {
            create: source.grants.map((g) => ({
              permissionKey: g.permissionKey,
              scope: g.scope,
            })),
          },
        },
        include: COUNTS,
      });
      return toSummary(copy);
    } catch (e) {
      throw this.translate(e);
    }
  }

  /** The full catalog of capabilities (titles, modules, risk tags, allowed scopes). */
  listCatalog() {
    return PERMISSION_CATALOG;
  }

  private normalise(key: string, scope: string): AccessScope {
    const s = ACCESS_SCOPES.find((x) => x === scope) ?? 'ALL';
    return scopesFor(key).includes(s) ? s : 'ALL';
  }

  async getGrants(groupId: string): Promise<GrantView[]> {
    await this.getSummary(groupId);
    const rows = await this.prisma.groupPermission.findMany({
      where: { groupId },
      select: { permissionKey: true, scope: true },
      orderBy: { permissionKey: 'asc' },
    });
    return rows.map((r) => ({
      key: r.permissionKey,
      scope: this.normalise(r.permissionKey, r.scope),
    }));
  }

  /**
   * Replace the group's grants with exactly this list. Returns what changed so the caller
   * can write a precise audit entry.
   */
  async setGrants(
    groupId: string,
    requested: { key: string; scope?: AccessScope }[],
  ): Promise<GrantChange> {
    const before = new Map(
      (await this.getGrants(groupId)).map((g) => [g.key, g.scope]),
    );

    const wanted = new Map<string, AccessScope>();
    for (const g of requested) {
      if (!PERMISSION_KEYS.includes(g.key)) {
        throw new BadRequestException(`Unknown permission: ${g.key}`);
      }
      const scope = g.scope ?? 'ALL';
      if (!scopesFor(g.key).includes(scope)) {
        throw new BadRequestException(
          `${g.key} cannot be limited to ${scope}. Allowed: ${scopesFor(g.key).join(', ')}`,
        );
      }
      wanted.set(g.key, scope);
    }

    const granted = [...wanted.keys()].filter((k) => !before.has(k));
    const revoked = [...before.keys()].filter((k) => !wanted.has(k));
    const scopeChanged = [...wanted.keys()].filter(
      (k) => before.has(k) && before.get(k) !== wanted.get(k),
    );

    await this.prisma.$transaction([
      this.prisma.groupPermission.deleteMany({
        where: { groupId, permissionKey: { notIn: [...wanted.keys()] } },
      }),
      ...[...wanted.entries()].map(([permissionKey, scope]) =>
        this.prisma.groupPermission.upsert({
          where: { groupId_permissionKey: { groupId, permissionKey } },
          create: { groupId, permissionKey, scope },
          update: { scope },
        }),
      ),
    ]);

    return {
      grants: [...wanted.entries()].map(([key, scope]) => ({ key, scope })),
      granted,
      revoked,
      scopeChanged,
    };
  }

  private translate(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return new ConflictException(
          'A user group with this name (or Keycloak group mapping) already exists.',
        );
      }
      if (e.code === 'P2025') {
        return new NotFoundException('User group not found');
      }
    }
    return e;
  }
}
