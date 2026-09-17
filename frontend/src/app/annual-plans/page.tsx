import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { AnnualPlan, User, Department, BusinessUnit } from "@auditdesk/shared";
import AnnualPlansClient from "./annual-plans-client";

export default async function AnnualPlansPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [annualPlans, users, departments, businessUnits] = await Promise.all([
    apiFetch<AnnualPlan[]>("/annual-plans"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<BusinessUnit[]>("/business-units"),
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
