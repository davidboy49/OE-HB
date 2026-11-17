-- AlterTable
ALTER TABLE "UserGroup" ADD COLUMN     "keycloakGroup" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_keycloakGroup_key" ON "UserGroup"("keycloakGroup");
