# Database Migrations

This directory contains Kysely migration files that define the full history of schema changes for this project.

## How Migrations Work

Kysely tracks which migrations have been applied by storing their names in a `kysely_migration` table in the database. On each run, it executes only the migrations that have not yet been applied, in chronological order determined by the file name.

Each migration file exports two functions:

- **`up`** — applies the change (run forward)
- **`down`** — reverts the change (run backward / rollback)

```ts
import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("example")
    .addColumn("id", "integer", (col) =>
      col.generatedAlwaysAsIdentity().primaryKey().notNull(),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("example").execute();
}
```

## File Naming Convention

Files are named with a timestamp prefix to guarantee deterministic ordering:

```
YYYYMMDDHHMMSS_<short_description>.ts
```

Example: `20260514000000_rename_family_name_to_last_name.ts`

Use `000000` as the time component unless multiple migrations are created on the same day, in which case increment the sequence (e.g. `000001`, `000002`, …).

## Golden Rule: Never Modify Existing Migration Files

**Existing migration files are immutable.** They form a permanent, append-only log of schema changes.

Modifying a file that has already been applied to any database (development, staging, or production) will cause a divergence between the migration history stored in the database and the actual schema. This leads to silent inconsistencies that are very hard to debug and can corrupt data.

> The only exception is a migration that exists solely on your local branch and has never been applied to any shared environment (i.e., not yet merged to the main branch and not yet run in staging/production). Once it is merged or applied somewhere, it is immutable.

To change the schema: **always create a new migration file.**

## Best Practices

- Keep each migration focused on a single, well-scoped change.
- Always implement both `up` and `down` so rollbacks are possible.
- Never use `Kysely<any>` — use `Kysely<unknown>` for pure schema-only migrations. When a migration includes data backfill queries, define a minimal local type inside the migration file and pass it as the type parameter instead:

  ```ts
  type MigrationDB = {
    project: { id: Generated<number>; name: string };
    post: { project_id: number | null };
  };

  export async function up(db: Kysely<MigrationDB>): Promise<void> { … }
  ```

  Keep the type as narrow as possible — only include the tables and columns actually touched by that migration.
- Prefer `generatedAlwaysAsIdentity()` over `serial` for auto-increment primary keys (PostgreSQL 10+).
- Use `sql` tagged template literals (from `kysely`) for raw SQL that cannot be expressed with the schema builder.
- Test your `down` function before merging — an untested rollback path is a liability.
- Do not read or write application data inside migrations unless absolutely necessary. Schema changes only.
- Prefer Kysely’s schema builder and query APIs for migrations. Use raw SQL only for schema changes or database features that cannot be expressed cleanly with Kysely. When raw SQL is used, keep it localized and document the reason if it is not obvious.

## Running Migrations

Migrations are run via `package.json` scripts (which include the dotenvx environment setup):

```sh
pnpm run migrate        # apply all pending migrations
pnpm run migrate:down   # roll back the last applied migration
```

Check `package.json` for the exact script names available in this project.
