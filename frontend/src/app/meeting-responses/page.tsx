import { redirect } from "next/navigation";
import { ApiError, apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { AnnualPlan, RollupPayload } from "@oeportal/shared";
import ResponsesClient from "./responses-client";

export const metadata = {
  title: "Department Responses | OE Portal",
};

export default async function MeetingResponsesPage() {
  await guardPage("/meeting-responses");

  let rollup: RollupPayload;
  let annualPlans: AnnualPlan[];
  try {
    [rollup, annualPlans] = await Promise.all([
      apiFetch<RollupPayload>("/meeting-responses/rollup"),
      fetchOr<AnnualPlan[]>("/annual-plans", []),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) redirect("/no-access");
    throw err;
  }
  return <ResponsesClient initialRollup={rollup} annualPlans={annualPlans} />;
}
