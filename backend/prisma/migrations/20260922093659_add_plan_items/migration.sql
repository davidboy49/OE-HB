-- Step 1 of 3 for normalizing the objectives/scope/data-request JSON-blob columns
-- (Project.objectives/scope, OePlan.objectives/scope/dataRequestType,
-- ExecutionSchedule.objectives/scope, OpenMeeting.objectives/scope) into real rows.
-- Purely additive - no existing column is touched or dropped yet. Next: a one-off backfill
-- script populates PlanItem from the old columns, then a later migration drops them once the
-- backfill is verified.

-- New generic child table - one row per objectives/scope/data-request list item, replacing
-- what used to be a JSON-encoded array in a String column.
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanItem_ownerType_ownerId_idx" ON "PlanItem"("ownerType", "ownerId");

-- OePlan.scope's replacement: the "which inherited items are turned off" half of the old
-- {inactiveIds, extraItems} JSON diff. A plain array column, not a blob - the "extraItems"
-- half becomes ordinary PlanItem rows (ownerType "OEPLAN_SCOPE_EXTRA").
ALTER TABLE "OePlan" ADD COLUMN "inactiveScopeItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Unrelated cosmetic cleanup the schema diff also picked up: the PlannedEngagement->Project
-- rename (see git history) renamed the Prisma model but left the underlying SQL constraint
-- names as they were. Renaming a constraint is metadata-only - it doesn't touch any row.
ALTER TABLE "Project" RENAME CONSTRAINT "PlannedEngagement_pkey" TO "Project_pkey";
ALTER TABLE "Document" RENAME CONSTRAINT "Document_projectId_fkey" TO "Document_oePlanId_fkey";
ALTER TABLE "ExecutionSchedule" RENAME CONSTRAINT "ExecutionSchedule_projectId_fkey" TO "ExecutionSchedule_oePlanId_fkey";
ALTER TABLE "OePlan" RENAME CONSTRAINT "OePlan_plannedEngagementId_fkey" TO "OePlan_projectId_fkey";
ALTER TABLE "OpenMeeting" RENAME CONSTRAINT "OpenMeeting_projectId_fkey" TO "OpenMeeting_oePlanId_fkey";
ALTER TABLE "Project" RENAME CONSTRAINT "PlannedEngagement_annualPlanId_fkey" TO "Project_annualPlanId_fkey";
ALTER TABLE "Project" RENAME CONSTRAINT "PlannedEngagement_departmentId_fkey" TO "Project_departmentId_fkey";
ALTER TABLE "Report" RENAME CONSTRAINT "Report_projectId_fkey" TO "Report_oePlanId_fkey";
