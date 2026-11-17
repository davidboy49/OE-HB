-- Step 3 of 3 for the objectives/scope/data-request normalization (see the add_plan_items
-- migration and prisma/backfill-plan-items.ts). Safe now, not destructive in effect: every
-- value these columns held has already been copied into PlanItem rows by the backfill script,
-- verified row-for-row against the originals, and the service layer has been switched over to
-- read/write PlanItem exclusively - nothing has read these columns since.

ALTER TABLE "ExecutionSchedule" DROP COLUMN "objectives",
DROP COLUMN "scope";

ALTER TABLE "OePlan" DROP COLUMN "dataRequestType",
DROP COLUMN "objectives",
DROP COLUMN "scope";

ALTER TABLE "OpenMeeting" DROP COLUMN "objectives",
DROP COLUMN "scope";

ALTER TABLE "Project" DROP COLUMN "objectives",
DROP COLUMN "scope";
