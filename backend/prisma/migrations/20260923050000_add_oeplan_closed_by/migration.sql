-- Who closed an OE Plan and when - server-stamped, never client-supplied (see
-- OePlansService.update). Additive, defaults to empty string for every existing row.
ALTER TABLE "OePlan" ADD COLUMN "closedByName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OePlan" ADD COLUMN "closedDate" TEXT NOT NULL DEFAULT '';
