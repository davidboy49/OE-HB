-- Hand-written (NOT the destructive add/drop `prisma migrate diff` produced - see git history
-- of this file for that draft, which would have silently discarded every plan's timeline and
-- approval data). Adds the new columns, COPIES the existing JSON-encoded values into them, then
-- drops the old columns - existing data survives.

-- 1. New, real columns.
ALTER TABLE "OePlan"
  ADD COLUMN "opExPresentationDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "opExNotificationDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "opExFieldWorkStart" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "opExFieldWorkEnd" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "opExFindingReportOffset" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "opExFinalReportOffset" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "preparedByName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "preparedByTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "preparedDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "approvedByName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "approvedByTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "approvedDate" TEXT NOT NULL DEFAULT '';

-- 2. Copy existing data. Guarded with a "looks like a JSON object" check so a blank or
-- otherwise malformed value (e.g. the column's own default of '') is left as the column
-- default above instead of erroring the whole migration on an invalid ::jsonb cast.
UPDATE "OePlan"
SET
  "opExPresentationDate" = COALESCE(NULLIF("opExTimeline", '')::jsonb ->> 'presentationDate', ''),
  "opExNotificationDate" = COALESCE(NULLIF("opExTimeline", '')::jsonb ->> 'notificationDate', ''),
  "opExFieldWorkStart" = COALESCE(NULLIF("opExTimeline", '')::jsonb ->> 'fieldWorkStart', ''),
  "opExFieldWorkEnd" = COALESCE(NULLIF("opExTimeline", '')::jsonb ->> 'fieldWorkEnd', ''),
  "opExFindingReportOffset" = COALESCE((NULLIF("opExTimeline", '')::jsonb ->> 'findingReportOffset')::int, 0),
  "opExFinalReportOffset" = COALESCE((NULLIF("opExTimeline", '')::jsonb ->> 'finalReportOffset')::int, 0)
WHERE "opExTimeline" ~ '^\s*\{';

UPDATE "OePlan"
SET
  "preparedByName" = COALESCE(NULLIF("approvals", '')::jsonb ->> 'preparedByName', ''),
  "preparedByTitle" = COALESCE(NULLIF("approvals", '')::jsonb ->> 'preparedByTitle', ''),
  "preparedDate" = COALESCE(NULLIF("approvals", '')::jsonb ->> 'preparedDate', ''),
  "approvedByName" = COALESCE(NULLIF("approvals", '')::jsonb ->> 'approvedByName', ''),
  "approvedByTitle" = COALESCE(NULLIF("approvals", '')::jsonb ->> 'approvedByTitle', ''),
  "approvedDate" = COALESCE(NULLIF("approvals", '')::jsonb ->> 'approvedDate', '')
WHERE "approvals" ~ '^\s*\{';

-- 3. Drop the old JSON-blob columns now that every value has a real home.
ALTER TABLE "OePlan"
  DROP COLUMN "opExTimeline",
  DROP COLUMN "approvals";
