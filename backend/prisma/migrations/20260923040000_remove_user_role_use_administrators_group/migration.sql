-- Removes User.role entirely: access is now 100% a function of UserGroup membership.
-- The old `role === 'ADMIN'` bypass (see PermissionsResolverService) is replaced by an
-- ordinary UserGroup - "Administrators" - granted every permission key. Nothing in code
-- treats this group specially; it is powerful purely because of its GroupPermission rows,
-- exactly like any other group.
--
-- Order matters: (1) make sure every current permission key exists (defensive - normally
-- populated by PermissionsResolverService.onApplicationBootstrap on app start, but this
-- migration must not depend on that having already run against this schema version),
-- (2) create the Administrators group and grant it every key, (3) move every existing
-- role='ADMIN' user into it (overwriting whatever group they had - their access was already
-- unconditional, so this is not a regression), (4) drop the now-unused column.

INSERT INTO "Permission" (key, description) VALUES
  ('annual-plans:view', 'View Annual OE Plans'),
  ('projects:view', 'View Projects'),
  ('oe-plans:view', 'View Individual OE Plans'),
  ('meetings:view', 'View Open Meetings'),
  ('execution-schedules:view', 'View Execution Schedules'),
  ('findings:view', 'View OE Findings and Findings Alerts'),
  ('departments:view', 'View departments'),
  ('business-units:view', 'View business units'),
  ('users:view', 'View the user list'),
  ('user-groups:view', 'View user groups, the permission catalog and API policies'),
  ('departments:create', 'Create departments'),
  ('departments:update', 'Edit departments'),
  ('departments:delete', 'Delete departments'),
  ('business-units:create', 'Create business units'),
  ('business-units:update', 'Edit business units'),
  ('business-units:delete', 'Delete business units'),
  ('users:create', 'Create users'),
  ('users:update', 'Edit user profiles/roles'),
  ('users:delete', 'Delete users'),
  ('users:set-password', 'Set another user''s password'),
  ('user-groups:create', 'Create and copy user groups'),
  ('user-groups:update', 'Edit user groups'),
  ('user-groups:delete', 'Delete user groups'),
  ('user-groups:manage-permissions', 'Grant/revoke permissions on a group'),
  ('oe-plans:create', 'Create Individual OE Plans'),
  ('oe-plans:update', 'Edit Individual OE Plans'),
  ('oe-plans:delete', 'Delete Individual OE Plans'),
  ('oe-plans:submit', 'Submit an Individual OE Plan for approval'),
  ('oe-plans:approve', 'Approve, reject, or reopen a submitted Individual OE Plan'),
  ('oe-plans:close', 'Close a released Individual OE Plan'),
  ('oe-plans:reopen', 'Reopen a closed Individual OE Plan'),
  ('execution-schedules:create', 'Create execution schedules'),
  ('execution-schedules:update', 'Edit execution schedules'),
  ('execution-schedules:delete', 'Delete execution schedules'),
  ('execution-schedules:confirm-others', 'Confirm another attendee''s attendance on an execution schedule'),
  ('meetings:create', 'Create open meetings'),
  ('meetings:update', 'Edit open meetings'),
  ('meetings:delete', 'Delete open meetings'),
  ('meetings:submit', 'Submit an open meeting report for approval'),
  ('meetings:approve', 'Approve, reject, or reopen a submitted open meeting report'),
  ('meetings:confirm-others', 'Confirm another attendee''s attendance on an open meeting'),
  ('findings:create', 'Log OE findings'),
  ('findings:update', 'Edit OE findings'),
  ('meeting-responses:create', 'Respond to your own department''s Open Meetings'),
  ('meeting-responses:view-all', 'See every Open Meeting and all department responses'),
  ('annual-plans:create', 'Create annual plans'),
  ('annual-plans:update', 'Edit annual plans'),
  ('annual-plans:delete', 'Delete annual plans'),
  ('annual-plans:submit', 'Submit an annual plan for approval'),
  ('annual-plans:approve', 'Approve or reject a submitted annual plan'),
  ('projects:create', 'Create Projects'),
  ('projects:update', 'Edit Projects'),
  ('projects:delete', 'Delete Projects'),
  ('notifications:configure', 'Edit SMTP config & email templates'),
  ('notifications:send-test', 'Send a test email'),
  ('notifications:send', 'Trigger meeting-release/finding/notification emails'),
  ('activity-logs:view', 'View the activity log'),
  ('activity-logs:create', 'Add a manual activity log entry'),
  ('activity-logs:delete', 'Delete an activity log entry')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  admin_group_id TEXT;
BEGIN
  SELECT id INTO admin_group_id FROM "UserGroup" WHERE name = 'Administrators';

  IF admin_group_id IS NULL THEN
    admin_group_id := (gen_random_uuid())::text;
    INSERT INTO "UserGroup" (id, name, description, "createdAt", "updatedAt")
    VALUES (
      admin_group_id,
      'Administrators',
      'Full access to every module - replaces the old ADMIN role.',
      now(),
      now()
    );
  END IF;

  INSERT INTO "GroupPermission" ("groupId", "permissionKey", scope, "createdAt", "updatedAt")
  SELECT admin_group_id, "key", 'ALL', now(), now() FROM "Permission"
  ON CONFLICT ("groupId", "permissionKey") DO NOTHING;

  UPDATE "User" SET "groupId" = admin_group_id WHERE role = 'ADMIN';
END $$;

ALTER TABLE "User" DROP COLUMN "role";
