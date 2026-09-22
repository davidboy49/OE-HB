import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { AnnualPlan, User, Department, BusinessUnit } from "@oeportal/shared";
import AnnualPlansClient from "./annual-plans-client";

export default async function AnnualPlansPage() {
  const currentUser = await guardPage("/annual-plans");

  const [annualPlans, users, departments, businessUnits] = await Promise.all([
    apiFetch<AnnualPlan[]>("/annual-plans"),
    fetchOr<User[]>("/users", []),
    fetchOr<Department[]>("/departments", []),
    fetchOr<BusinessUnit[]>("/business-units", []),
  ]);

  return (
    <AnnualPlansClient
      initialAnnualPlans={annualPlans}
      initialUsers={users}
      departments={departments}
      businessUnits={businessUnits}
      currentUser={currentUser}
    />
  );
}
