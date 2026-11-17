-- Group grants become records that carry a scope ("how far does this permission reach").
-- The old implicit many-to-many table is migrated, not just dropped, so existing groups keep
-- their permissions. Order matters: create the new table, copy, then drop the old one.

-- CreateTable
CREATE TABLE "GroupPermission" (
    "groupId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPermission_pkey" PRIMARY KEY ("groupId","permissionKey")
);

-- CreateIndex
CREATE INDEX "GroupPermission_permissionKey_idx" ON "GroupPermission"("permissionKey");

-- AddForeignKey
ALTER TABLE "GroupPermission" ADD CONSTRAINT "GroupPermission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPermission" ADD CONSTRAINT "GroupPermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy every existing grant across (implicit table: "A" = Permission.key, "B" = UserGroup.id).
INSERT INTO "GroupPermission" ("groupId", "permissionKey", "scope", "updatedAt")
SELECT "B", "A", 'ALL', CURRENT_TIMESTAMP FROM "_PermissionToUserGroup";

-- The new "view" permissions. The application also creates any missing permission rows when it
-- starts; they are inserted here so existing groups can be granted them below.
INSERT INTO "Permission" ("key", "description") VALUES
  ('annual-plans:view', 'View Annual OE Plans'),
  ('planned-engagements:view', 'View Projects'),
  ('oe-plans:view', 'View Individual OE Plans'),
  ('meetings:view', 'View Open Meetings'),
  ('execution-schedules:view', 'View Execution Schedules'),
  ('findings:view', 'View OE Findings and Findings Alerts'),
  ('departments:view', 'View departments'),
  ('business-units:view', 'View business units'),
  ('users:view', 'View the user list'),
  ('user-groups:view', 'View user groups, the permission catalog and API policies')
ON CONFLICT ("key") DO NOTHING;

-- Keep existing groups working: a group that already acts on a module may also view it
-- (scope ALL, exactly what they could do before view permissions existed).
INSERT INTO "GroupPermission" ("groupId", "permissionKey", "scope", "updatedAt")
SELECT DISTINCT gp."groupId", split_part(gp."permissionKey", ':', 1) || ':view', 'ALL', CURRENT_TIMESTAMP
FROM "GroupPermission" gp
WHERE split_part(gp."permissionKey", ':', 1) IN (
  'annual-plans', 'planned-engagements', 'oe-plans', 'meetings', 'execution-schedules',
  'findings', 'departments', 'business-units', 'users', 'user-groups'
)
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "_PermissionToUserGroup" DROP CONSTRAINT "_PermissionToUserGroup_A_fkey";

-- DropForeignKey
ALTER TABLE "_PermissionToUserGroup" DROP CONSTRAINT "_PermissionToUserGroup_B_fkey";

-- DropTable
DROP TABLE "_PermissionToUserGroup";
