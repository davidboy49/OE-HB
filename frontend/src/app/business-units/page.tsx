import { apiFetch } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { BusinessUnit } from "@oeportal/shared";
import BusinessUnitsClient from "./business-units-client";

export default async function BusinessUnitsPage() {
  const currentUser = await guardPage("/business-units");

  const businessUnits = await apiFetch<BusinessUnit[]>("/business-units");

  return (
    <BusinessUnitsClient
      initialBusinessUnits={businessUnits}
      currentUser={currentUser}
    />
  );
}
