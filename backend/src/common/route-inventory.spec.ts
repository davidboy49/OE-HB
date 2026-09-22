import * as fs from 'fs';
import * as path from 'path';
import type { Type } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { inventoryRoutes } from './route-inventory';
import { PERMISSION_KEYS } from './permissions';

/** Every *.controller.ts under src/ (read from disk, so a new controller is picked up automatically). */
function loadControllers(): Array<Type<unknown>> {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory()) {
        return e.name === 'generated' ? [] : walk(path.join(dir, e.name));
      }
      return e.name.endsWith('.controller.ts') ? [path.join(dir, e.name)] : [];
    });

  const found: Array<Type<unknown>> = [];
  for (const file of walk(path.join(__dirname, '..'))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    for (const exported of Object.values(require(file) as object)) {
      if (
        typeof exported === 'function' &&
        Reflect.getMetadata(PATH_METADATA, exported) !== undefined
      ) {
        found.push(exported as Type<unknown>);
      }
    }
  }
  return found;
}

describe('route inventory / access audit', () => {
  const controllers = loadControllers();
  const routes = inventoryRoutes(controllers);

  it('finds the application controllers', () => {
    expect(controllers.length).toBeGreaterThanOrEqual(15);
    expect(routes.length).toBeGreaterThan(50);
  });

  it('every route declares how it is protected (nothing is left open by omission)', () => {
    const undeclared = routes
      .filter((r) => r.access === 'UNDECLARED')
      .map((r) => `${r.method} ${r.path}`)
      .sort();
    expect(undeclared).toEqual([]);
  });

  it('every read of a record module requires its view permission', () => {
    const viewModules = [
      'annual-plans',
      'projects',
      'oe-plans',
      'meetings',
      'execution-schedules',
      'findings',
      'departments',
      'business-units',
      'users',
      'user-groups',
    ];
    const weak = routes
      .filter(
        (r) =>
          r.method === 'GET' &&
          viewModules.some(
            (m) => r.path === `/${m}` || r.path.startsWith(`/${m}/`),
          ) &&
          !(r.permission ?? '').split(' | ').some((k) => k.endsWith(':view')),
      )
      .map((r) => `${r.method} ${r.path}`);
    expect(weak).toEqual([]);
  });

  it('only the login and SSO exchange are public', () => {
    const open = routes
      .filter((r) => r.access === 'PUBLIC')
      .map((r) => `${r.method} ${r.path}`)
      .sort();
    expect(open).toEqual(['POST /auth/login', 'POST /auth/sso']);
  });

  it('every permission a route names exists in the permission catalog', () => {
    const unknown = routes
      .flatMap((r) => (r.permission ? r.permission.split(' | ') : []))
      .filter((key) => !PERMISSION_KEYS.includes(key));
    expect(unknown).toEqual([]);
  });

  it('marks routes that decide their permission inside the handler', () => {
    const dynamic = routes
      .filter((r) => r.dynamic)
      .map((r) => `${r.method} ${r.path}`)
      .sort();
    expect(dynamic).toEqual([
      'PATCH /annual-plans/:id/status',
      'PATCH /meetings/:id/status',
      'PATCH /oe-plans/:id',
    ]);
  });
});
