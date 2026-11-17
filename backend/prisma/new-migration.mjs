#!/usr/bin/env node
/**
 * Creates the next migration from the difference between the database and schema.prisma.
 *
 *   npm run db:migration:new -- add_group_permission
 *
 * It only WRITES prisma/migrations/<timestamp>_<name>/migration.sql - it does not touch the
 * database. Read the SQL, then apply it with `npm run db:migrate:deploy`.
 *
 * Why not `prisma migrate dev`? That needs a "shadow database" (permission to create a
 * scratch database), which a shared remote dev database usually does not allow. This works
 * as long as the database is at the last committed migration (check: `npm run db:migrate:status`).
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const name = (process.argv[2] || "").trim().replace(/[^a-zA-Z0-9_]+/g, "_");
if (!name) {
  console.error("Usage: npm run db:migration:new -- <short_snake_case_name>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = execSync(
  "npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script",
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

// Drop the CLI banner / update notice lines that share stdout with the SQL.
const sql = raw
  .split(/\r?\n/)
  .filter((l) => !/^[│┌└├╭╰]|^Loaded Prisma|Update available|major update/.test(l))
  .join("\n")
  .trim();

if (!sql || /^-- This is an empty migration/i.test(sql)) {
  console.log("No changes: the database already matches schema.prisma.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const dir = join(root, "prisma", "migrations", `${stamp}_${name}`);
if (existsSync(dir)) {
  console.error(`Already exists: ${dir}`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), sql + "\n");

const destructive = sql.split("\n").filter((l) => /^(DROP TABLE|ALTER TABLE .* DROP COLUMN|TRUNCATE)/i.test(l));
console.log(`Wrote ${dir}`);
if (destructive.length) {
  console.log("\nWARNING - this migration removes data structures. Review before applying:");
  destructive.forEach((l) => console.log("  " + l));
}
console.log("\nNext: review the SQL, then run `npm run db:migrate:deploy`.");
