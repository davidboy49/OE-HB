INSERT INTO "Permission" (key, description)
VALUES (
  'execution-schedules:delete-finding-row',
  'Delete finding rows from OE Findings reports'
)
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- Preserve full access for the ordinary Administrators group. Other groups receive this
-- permission only when it is explicitly granted from Access Control.
INSERT INTO "GroupPermission" ("groupId", "permissionKey", scope, "createdAt", "updatedAt")
SELECT id, 'execution-schedules:delete-finding-row', 'ALL', now(), now()
FROM "UserGroup"
WHERE name = 'Administrators'
ON CONFLICT ("groupId", "permissionKey") DO NOTHING;
