# Database migrations

This document records project-specific conventions for database migrations.

## Principles

Migrations are historical artifacts that describe how a database evolved over time.

They are not snapshots of the current schema and should not be treated as editable implementation files.

Once a migration has been merged or applied to a shared environment:

- treat it as immutable
- preserve its historical meaning
- create a new migration instead of rewriting history

Changing a previously applied migration can cause environments to diverge because different databases may have executed different versions of what appears to be the same migration.

## Migration isolation

Migrations should remain self-contained and executable indefinitely.

Because migrations are historical artifacts, they may run long after surrounding application code has changed.

Avoid dependencies on mutable parts of the codebase.

- Do not import generated database types.
- Do not import application models, helpers, utilities, constants, or business logic.
- Do not import types from application code that may evolve independently of the migration.

External package dependencies should be treated as prohibited by default.

Migrations should not depend on packages outside the migration system itself (for example Kysely and its migration infrastructure).

Avoid importing third-party libraries because:

- package APIs and behavior evolve over time
- packages may be replaced or removed
- dependency updates can change migration behavior without changing the migration itself
- migrations should remain reproducible historical artifacts

Prefer built-in language and platform capabilities.

If a migration genuinely cannot be implemented without an additional dependency, document the reason explicitly in the migration and obtain review before introducing it.

## Migration typing

Schema-only migrations should use:

```ts
Kysely<unknown>
```

Migrations that need to query or transform data should define a minimal local database type directly in the migration file.

Keep local migration types limited to only required tables and columns.

Prefer:

```ts
type MigrationDB = {
  project: {
    id: number;
    slug: string;
  };
};

export async function up(
  db: Kysely<MigrationDB>,
): Promise<void> {
  // Migration logic
}
```

Don't:

```ts
import type { Database } from "@/db/generated-types";
```

## Safety and data integrity

Data preservation takes priority over migration completion.

- Prefer failing loudly over silently modifying, dropping, or guessing data.
- If a migration cannot safely determine how existing data should be transformed, stop and raise an explicit error.
- Error messages should explain:
  - what condition prevented the migration
  - why automatic migration is unsafe
  - what action is required before the migration can proceed

Avoid destructive fallback behavior such as:

- deleting records
- selecting arbitrary rows
- silently merging conflicting data
- generating replacement values that alter semantics

Good:

```ts
throw new Error(
  "Cannot run down migration because multiple projects exist. Previous data state only supported a single project. Remove extra projects before retrying migration."
);
```

Don't:

```ts
// Keep only first project and delete others.
await db
  .deleteFrom("project")
  .where(/* ... */)
  .execute();
```

## Project conventions

Migration files live in:

```txt
src/db/migrations/
```

Migration files are ordered by their timestamp prefix:

```txt
YYYYMMDDHHMMSS_short_description.ts
```

Example:

```txt
20260520153000_add_project_public_id.ts
```

Prefer `generatedAlwaysAsIdentity()` over `serial` for new auto-incrementing primary keys.

Keep migrations focused on one schema or data change.

Avoid application data changes unless required for the schema change.

Implement `down` when practical.

If `down` cannot safely preserve data, make that explicit in the migration.

## Prefer the Kysely schema builder over raw SQL

Prefer Kysely's schema builder and query APIs for migrations (`renameTo`,
`renameColumn`, `addColumn`, `createTable`, `dropConstraint`, `createIndex`, …).

Use raw `sql` tagged templates only for changes Kysely cannot express cleanly —
for example enum type/value renames (`ALTER TYPE`), trigger and function
management, or `ALTER TABLE … RENAME CONSTRAINT`, none of which have a schema
builder API. When raw SQL is used, keep it localized and document why it is
necessary if the reason is not obvious.

### The CamelCasePlugin identifier trap

The two migration runners are not configured identically, and this changes how
object identifiers are spelled on disk:

- The production runner (`src/db/migrate.ts`, used by `pnpm run db:migrate:*`)
  builds its Kysely **without** `CamelCasePlugin`.
- The integration-test runner (`src/test/dbIntegration.ts`) and the production
  runtime client (`src/db/kysely.ts`) build Kysely **with** `CamelCasePlugin`.

`CamelCasePlugin` snake_cases identifier strings passed to the **schema
builder**, but it does not touch identifiers written inside a raw `sql` template.
So a name a builder call spelled `"Rubric_projectId_fkey"` is created verbatim by
the plain prod runner but as `rubric_project_id_fkey` by the plugin-enabled test
runner. A later migration that references that name in **raw SQL** by one exact
spelling therefore succeeds in one environment and fails in the other.

Consequences for writing migrations:

- Rename tables and columns with the schema builder (`renameTo`,
  `renameColumn`). Their names are lowercase/`snake_case`, so the plugin is a
  no-op and both runners agree.
- To rename a **constraint or index** (no builder API, so raw SQL is required),
  do not hard-code a single old spelling. Look the object up dynamically (e.g. a
  `DO` block over `pg_constraint`/`pg_class` matching a small set of candidate
  names) or drop it with `IF EXISTS` against every candidate spelling, then
  re-create it with the new name. This keeps the migration correct under both
  runners and leaves no stale name behind in either.
- Constraint/index identifiers are never referenced by application code, so
  renaming them is purely cosmetic — but if you rename them, do it robustly
  rather than by a single fragile literal.

## Running migrations

Use project scripts rather than direct commands:

```sh
pnpm run migrate
pnpm run migrate:down
```

Check `package.json` for the exact available scripts.

## Generated DB types policy

The generated Kysely database types file is source-of-truth codegen output:

- Never hand-edit `src/db/generated/db.ts`.
- After schema changes, regenerate types with:

```sh
pnpm run db:types:generate
```

## Identifier boundary policy

Some tables expose both an internal surrogate key and a public identifier.
When that pattern exists:

- the internal key is for joins, foreign keys, and other DB-internal work only
- the public identifier is what app and route code should use
- DB read/write helpers may resolve the internal key locally, but should not expose it in public-facing outputs unless the caller explicitly needs an internal DB key, which is rare and should be justified