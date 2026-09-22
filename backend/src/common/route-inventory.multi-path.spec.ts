import { Controller, Get } from '@nestjs/common';
import { inventoryRoutes } from './route-inventory';
import { RequirePermission } from './decorators/require-permission.decorator';

/**
 * A controller path can be an array (e.g. @Controller(['projects', 'planned-engagements']),
 * kept so an old client keeps working under its original URL). Nest registers one real route
 * per entry, sharing the same handler and the same access rule - the inventory must report
 * both real paths, never a single path that concatenates the two prefixes together.
 */
@Controller(['projects', 'planned-engagements'])
class FakeAliasedController {
  @Get()
  @RequirePermission('projects:view')
  findAll() {
    return [];
  }

  @Get(':id')
  @RequirePermission('projects:view')
  findOne() {
    return {};
  }
}

describe('inventoryRoutes - controllers with several path prefixes', () => {
  const routes = inventoryRoutes([FakeAliasedController]);

  it('emits one route per prefix, not a combined nonsense path', () => {
    const paths = routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(paths).toEqual([
      'GET /planned-engagements',
      'GET /planned-engagements/:id',
      'GET /projects',
      'GET /projects/:id',
    ]);
  });

  it('gives every alias the same protection as the primary path', () => {
    expect(routes.every((r) => r.permission === 'projects:view')).toBe(true);
  });
});
