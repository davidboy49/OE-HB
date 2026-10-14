INSERT INTO "Permission" (key, description)
VALUES ('findings-alerts:view', 'View Findings Alerts')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

UPDATE "Permission" SET description = 'View OE Findings' WHERE key = 'findings:view';

-- Findings Alerts used to be covered by findings:view. Carry that access over to every group
-- that holds it today; from here on the two are granted independently from Access Control.
INSERT INTO "GroupPermission" ("groupId", "permissionKey", scope, "createdAt", "updatedAt")
SELECT "groupId", 'findings-alerts:view', 'ALL', now(), now()
FROM "GroupPermission"
WHERE "permissionKey" = 'findings:view'
ON CONFLICT ("groupId", "permissionKey") DO NOTHING;
