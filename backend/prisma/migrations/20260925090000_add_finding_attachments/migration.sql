-- Finding row attachments move out of ExecutionSchedule.scheduleRows (base64 inside one JSON
-- string, which capped a whole report at Express's 100kb body limit) into their own tables.
-- Purely additive. No existing report held attachment data when this shipped, so there is
-- nothing to backfill.

CREATE TABLE "FindingAttachment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL,
    "storage" TEXT NOT NULL DEFAULT 'postgres',
    "storageKey" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FindingAttachment_scheduleId_rowId_idx" ON "FindingAttachment"("scheduleId", "rowId");

ALTER TABLE "FindingAttachment" ADD CONSTRAINT "FindingAttachment_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "ExecutionSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bytes for the "postgres" storage driver, kept apart so metadata queries never load them.
CREATE TABLE "FindingAttachmentBlob" (
    "attachmentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "FindingAttachmentBlob_pkey" PRIMARY KEY ("attachmentId")
);

ALTER TABLE "FindingAttachmentBlob" ADD CONSTRAINT "FindingAttachmentBlob_attachmentId_fkey"
    FOREIGN KEY ("attachmentId") REFERENCES "FindingAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
