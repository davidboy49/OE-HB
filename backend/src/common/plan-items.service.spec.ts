/* eslint-disable @typescript-eslint/unbound-method */
import { PlanItemsService } from './plan-items.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService(
  opts: { rows?: { ownerId: string; itemId: string; text: string }[] } = {},
) {
  const created: { data: unknown }[] = [];
  const deleted: { where: unknown }[] = [];
  const prisma = {
    planItem: {
      findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
      deleteMany: jest.fn().mockImplementation((args) => {
        deleted.push(args);
        return { args };
      }),
      createMany: jest.fn().mockImplementation((args) => {
        created.push(args);
        return { args };
      }),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
  } as unknown as PrismaService;
  return { service: new PlanItemsService(prisma), prisma, created, deleted };
}

describe('PlanItemsService.writeList', () => {
  it('does nothing when raw is undefined (partial update leaves existing rows alone)', async () => {
    const { service, prisma } = makeService();
    await service.writeList('PROJECT_OBJECTIVE', 'p1', undefined, 'IOE-OBJ');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('clears to zero rows for an empty/blank value', async () => {
    const { service, prisma, created } = makeService();
    await service.writeList('PROJECT_OBJECTIVE', 'p1', '', 'IOE-OBJ');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.planItem.deleteMany).toHaveBeenCalledWith({
      where: { ownerType: 'PROJECT_OBJECTIVE', ownerId: 'p1' },
    });
    expect(created).toHaveLength(0);
  });

  it('replaces existing rows with the parsed items, in order', async () => {
    const { service, created } = makeService();
    const raw = JSON.stringify([
      { id: 'IOE-OBJ-01', text: 'First' },
      { id: 'IOE-OBJ-02', text: 'Second' },
    ]);
    await service.writeList('PROJECT_OBJECTIVE', 'p1', raw, 'IOE-OBJ');
    expect(created).toHaveLength(1);
    expect(created[0].data).toEqual([
      {
        ownerType: 'PROJECT_OBJECTIVE',
        ownerId: 'p1',
        itemId: 'IOE-OBJ-01',
        text: 'First',
        order: 0,
      },
      {
        ownerType: 'PROJECT_OBJECTIVE',
        ownerId: 'p1',
        itemId: 'IOE-OBJ-02',
        text: 'Second',
        order: 1,
      },
    ]);
  });

  it('drops the blank placeholder item parsePlanItems returns for an empty JSON array', async () => {
    const { service, created } = makeService();
    await service.writeList('PROJECT_OBJECTIVE', 'p1', '[]', 'IOE-OBJ');
    expect(created).toHaveLength(0);
  });

  it('keeps legacy non-JSON text as one real item, not a blank placeholder', async () => {
    const { service, created } = makeService();
    await service.writeList(
      'PROJECT_OBJECTIVE',
      'p1',
      'legacy plain text',
      'IOE-OBJ',
    );
    expect(created[0].data).toEqual([
      {
        ownerType: 'PROJECT_OBJECTIVE',
        ownerId: 'p1',
        itemId: 'IOE-OBJ-01',
        text: 'legacy plain text',
        order: 0,
      },
    ]);
  });

  it('drops items with blank text even if present in the raw JSON', async () => {
    const { service, created } = makeService();
    const raw = JSON.stringify([{ id: 'IOE-OBJ-01', text: '   ' }]);
    await service.writeList('PROJECT_OBJECTIVE', 'p1', raw, 'IOE-OBJ');
    expect(created).toHaveLength(0);
  });
});

describe('PlanItemsService.readOne / readMany', () => {
  it('returns an empty array for an owner with no rows', async () => {
    const { service } = makeService({ rows: [] });
    await expect(service.readOne('PROJECT_OBJECTIVE', 'p1')).resolves.toBe(
      '[]',
    );
  });

  it('serializes rows back into the wire {id,text} shape, in order', async () => {
    const { service } = makeService({
      rows: [
        { ownerId: 'p1', itemId: 'IOE-OBJ-02', text: 'Second' },
        { ownerId: 'p1', itemId: 'IOE-OBJ-01', text: 'First' },
      ],
    });
    // findMany is mocked to return rows already in whatever order it's given; the service
    // relies on the DB's orderBy, so here we just check the shape survives the round trip.
    await expect(service.readOne('PROJECT_OBJECTIVE', 'p1')).resolves.toBe(
      JSON.stringify([
        { id: 'IOE-OBJ-02', text: 'Second' },
        { id: 'IOE-OBJ-01', text: 'First' },
      ]),
    );
  });

  it('gives every requested owner id an entry, even ones with no rows at all', async () => {
    const { service } = makeService({
      rows: [{ ownerId: 'p1', itemId: 'IOE-OBJ-01', text: 'Only p1' }],
    });
    const result = await service.readMany('PROJECT_OBJECTIVE', ['p1', 'p2']);
    expect(result.get('p1')).toBe(
      JSON.stringify([{ id: 'IOE-OBJ-01', text: 'Only p1' }]),
    );
    expect(result.get('p2')).toBe('[]');
  });

  it('returns an empty map without querying when no owner ids are given', async () => {
    const { service, prisma } = makeService();
    const result = await service.readMany('PROJECT_OBJECTIVE', []);
    expect(result.size).toBe(0);
    expect(prisma.planItem.findMany).not.toHaveBeenCalled();
  });
});

describe('PlanItemsService scope override helpers', () => {
  it('splits a scope diff into inactiveScopeItemIds and an extraItems JSON string', () => {
    const { service } = makeService();
    const raw = JSON.stringify({
      inactiveIds: ['OE-SCP-01'],
      extraItems: [{ id: 'OE-SCP-99', text: 'Extra' }],
    });
    expect(service.parseScopeOverrideInput(raw)).toEqual({
      inactiveScopeItemIds: ['OE-SCP-01'],
      extraItemsRaw: JSON.stringify([{ id: 'OE-SCP-99', text: 'Extra' }]),
    });
  });

  it('returns undefined for both halves when raw is undefined', () => {
    const { service } = makeService();
    expect(service.parseScopeOverrideInput(undefined)).toEqual({
      inactiveScopeItemIds: undefined,
      extraItemsRaw: undefined,
    });
  });

  it('reconstructs the wire diff from the column value plus extra-item rows', async () => {
    const { service } = makeService({
      rows: [{ ownerId: 'plan1', itemId: 'OE-SCP-99', text: 'Extra' }],
    });
    await expect(
      service.readScopeOverride('plan1', ['OE-SCP-01']),
    ).resolves.toBe(
      JSON.stringify({
        inactiveIds: ['OE-SCP-01'],
        extraItems: [{ id: 'OE-SCP-99', text: 'Extra' }],
      }),
    );
  });
});
