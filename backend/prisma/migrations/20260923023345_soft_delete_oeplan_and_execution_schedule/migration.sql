-- AlterTable
ALTER TABLE "ExecutionSchedule" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OePlan" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
