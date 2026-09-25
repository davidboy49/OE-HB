-- The department code the admin types (e.g. "FIN") used to be the primary key, so the same
-- code could not exist under two Business Units. It moves to its own column, unique per BU;
-- new departments get a generated id. Existing rows keep their id (every FK and the
-- comma-separated OePlan.departments lists point at it) and take it as their code.

ALTER TABLE "Department" ADD COLUMN "code" TEXT;
UPDATE "Department" SET "code" = "id";
ALTER TABLE "Department" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Department_businessUnitId_code_key" ON "Department"("businessUnitId", "code");
