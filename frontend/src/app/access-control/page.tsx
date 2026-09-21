import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { ApiRoutePolicy, PermissionCatalogEntry, UserGroup } from "@oeportal/shared";
import AccessControlClient from "./access-control-client";

export const metadata = {
  title: "Access Control | OE Portal",
};

export default async function AccessControlPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const currentUser = await guardPage("/access-control");
  const { group } = await searchParams;

  const [groups, catalog, routes] = await Promise.all([
    apiFetch<UserGroup[]>("/user-groups"),
    apiFetch<PermissionCatalogEntry[]>("/permissions"),
    fetchOr<ApiRoutePolicy[]>("/permissions/routes", []),
  ]);

  return (
    <AccessControlClient
      initialGroups={groups}
      catalog={catalog}
      routes={routes}
      currentUser={currentUser}
      initialGroupId={group ?? null}
    />
  );
}
