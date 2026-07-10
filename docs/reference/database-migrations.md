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

Prefer Kysely's schema builder for migrations. It covers more than schema
creation — including things easy to assume it lacks:

- tables: `alterTable(t).renameTo(...)`, `createTable`, `dropTable`
- columns: `alterTable(t).renameColumn(...)`, `addColumn`, `alterColumn`
- constraints: `alterTable(t).renameConstraint(...)`, `addForeignKeyConstraint`,
  `addUniqueConstraint`, `addCheckConstraint`, `dropConstraint`
- enum types: `alterType(t).renameTo(...)` / `.renameValue(...)` / `.addValue(...)`,
  plus `createType`/`dropType`

Use raw `sql` tagged templates only for changes the builder genuinely cannot
express — in this codebase that is **index renames** (there is no
`alterIndex`/`renameIndex`; only `createIndex`/`dropIndex`) and **trigger /
function** management. When raw SQL is used, keep it localized and document why
it is necessary if the reason is not obvious.

Run one DDL statement at a time (`await` each). Do not `Promise.all` schema
changes: each `ALTER TABLE`/`ALTER TYPE` takes a heavy lock, so running them
concurrently only makes them contend (and risk deadlocks) for no benefit — a
migration is a one-time operation, not a hot path.

### No CamelCasePlugin on migration runners

The two migration runners (`src/db/migrate.ts` and `createDisposableMigrationDb`
in `src/test/dbIntegration.ts`) build Kysely **without** plugins. The two query
clients (`src/db/kysely.ts`, `startTestDatabase`) keep `CamelCasePlugin` — that
is what maps camelCase TypeScript properties to snake_case columns and is
unrelated to migrations.

Never add a name-transforming plugin to a migration runner. Migrations are
immutable history, but a plugin on the runner retroactively changes what the
committed chain produces: the plugin rewrites identifier strings passed to the
schema builder (never raw `sql`), so the same migration file creates
differently named objects depending on the runner configuration in effect when
it ran. This happened once — the runners briefly carried `CamelCasePlugin`,
which forked builder-created constraint names between databases migrated before
and after (e.g. `Student_projectId_id_key` vs `student_project_id_id_key`) and
broke `down` paths that referenced the original names through the builder.

With plugin-less runners, migrations receive their identifier strings verbatim,
so object names are deterministic and identical on every database. Write all
identifiers in migrations exactly as they exist in Postgres.

Constraint and index names are snake_case since
`20260709000001_snake_case_constraint_and_index_names.ts`, which case-folded the
remaining Prisma-era PascalCase names. Later migrations rename constraints with
plain `alterTable(t).renameConstraint(old, new)` calls — the candidate-spelling
`DO` block in `20260707000000_rename_rubric_to_criterion.ts` was a workaround
for the plugin fork and is not a pattern to copy.

### Reserved-word table and column names

A table or column can be named after a SQL reserved word (for example
`group`). The Kysely schema and query builders quote identifiers
automatically, so ordinary builder usage is unaffected. Raw `sql` tagged
templates do not: quote the identifier explicitly (`"group"`, or
`sql.id("group")`) wherever one appears in raw SQL, including index renames
and trigger/function bodies.

### Enum value and column renames update dependent CHECK constraints automatically

Postgres tracks a `CHECK` constraint's compiled expression by column attribute
number and, for enum comparisons, by the enum value's OID — not by the
identifier spelling. Renaming a column (`alterTable(t).renameColumn(...)`) or
an enum value (`alterType(t).renameValue(...)`) updates every dependent CHECK
constraint's displayed body automatically; no drop/recreate is needed. This
does **not** extend to trigger or function bodies, which store their old/new
identifiers as plain text and must be rewritten explicitly (see
`CREATE OR REPLACE FUNCTION` usage in `20260707000000_rename_rubric_to_criterion.ts`).

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