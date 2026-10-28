-- Departments are deactivated instead of deleted.
ALTER TABLE "Department" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
