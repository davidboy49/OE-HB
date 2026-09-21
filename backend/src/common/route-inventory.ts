import 'reflect-metadata';
import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { REQUIRE_PERMISSION_KEY } from './decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { IS_AUTHENTICATED_KEY } from './decorators/authenticated.decorator';
import { DYNAMIC_PERMISSIONS_KEY } from './decorators/dynamic-permission.decorator';

/** How a route is protected. UNDECLARED is a bug: nobody decided who may call it. */
export type RouteAccess =
  'PUBLIC' | 'AUTHENTICATED' | 'PERMISSION' | 'UNDECLARED';

export interface RouteInfo {
  controller: string;
  handler: string;
  method: string;
  /** Full path, e.g. /oe-plans/:id */
  path: string;
  access: RouteAccess;
  /** Set when access is PERMISSION, e.g. "oe-plans:update". For dynamic routes: the keys joined with " | ". */
  permission?: string;
  /** True when the handler itself decides which of the permissions applies. */
  dynamic?: boolean;
}

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

const joinPath = (...parts: Array<string | string[] | undefined>) =>
  '/' +
  parts
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

/**
 * Lists every HTTP route of the given controller classes with the way it is protected, read
 * straight from the decorators (no server, no database). Route-level metadata wins over
 * controller-level, matching how the guards resolve it at runtime.
 */
export function inventoryRoutes(
  controllers: Array<Type<unknown>>,
): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const ctrl of controllers) {
    const basePath = Reflect.getMetadata(PATH_METADATA, ctrl) as
      string | string[] | undefined;
    const proto = ctrl.prototype as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        number | undefined;
      if (method === undefined) continue;

      const read = <T>(key: string): T | undefined =>
        (Reflect.getMetadata(key, handler) as T | undefined) ??
        (Reflect.getMetadata(key, ctrl) as T | undefined);

      const dynamicKeys = read<string[]>(DYNAMIC_PERMISSIONS_KEY);
      const permission =
        read<string>(REQUIRE_PERMISSION_KEY) ?? dynamicKeys?.join(' | ');
      const isPublic = read<boolean>(IS_PUBLIC_KEY);
      const isAuthenticated = read<boolean>(IS_AUTHENTICATED_KEY);
      const routePath = Reflect.getMetadata(PATH_METADATA, handler) as
        string | string[] | undefined;

      routes.push({
        controller: ctrl.name,
        handler: name,
        method: METHOD_NAMES[method] ?? String(method),
        path: joinPath(basePath, routePath),
        access: isPublic
          ? 'PUBLIC'
          : permission
            ? 'PERMISSION'
            : isAuthenticated
              ? 'AUTHENTICATED'
              : 'UNDECLARED',
        permission: permission ?? undefined,
        dynamic: dynamicKeys ? true : undefined,
      });
    }
  }

  return routes.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}
