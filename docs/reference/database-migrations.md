# Database migrations

Status: Current reference

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

Prefer Kysely schema and query APIs.

Use raw SQL only when Kysely cannot express the change clearly.

## Running migrations

Use project scripts rather than direct commands:

```sh
pnpm run migrate
pnpm run migrate:down
```

Check `package.json` for the exact available scripts.