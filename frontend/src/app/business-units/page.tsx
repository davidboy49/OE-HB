import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { BusinessUnit } from "@oeportal/shared";
import BusinessUnitsClient from "./business-units-client";

export default async function BusinessUnitsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const businessUnits = await apiFetch<BusinessUnit[]>("/business-units");

  return (
    <BusinessUnitsClient
      initialBusinessUnits={businessUnits}
      currentUser={currentUser}
    />
  );
}
