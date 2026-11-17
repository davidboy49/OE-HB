# Database changes (Prisma migrations)

Schema history lives in `backend/prisma/migrations/`. `0_init` is the baseline of the schema as
it was when migrations were introduced; every later change is its own folder.

## Changing the schema
1. Edit `backend/prisma/schema.prisma`.
2. From `backend/`:
   ```bash
   npm run db:migration:new -- short_snake_case_name   # writes the SQL, does NOT touch the database
   ```
3. **Read the generated `migration.sql`.** The script warns about `DROP TABLE` / `DROP COLUMN`.
4. Apply it: `npm run db:migrate:deploy`, then `npx prisma generate`.
5. Commit the new folder together with the schema change.

## Checking state
```bash
npm run db:migrate:status   # "Database schema is up to date!" when nothing is pending
```

## Rules
- Never edit or delete a migration that has been applied anywhere; add a new one.
- Do **not** use `prisma db push` on shared or production databases - it leaves no history and
  cannot be rolled back.
- Production: deploy with `npm run db:migrate:deploy` (never `migrate dev`).
- Why not `migrate dev`? It needs a scratch "shadow database"; a shared remote dev database
  normally does not allow creating one.
