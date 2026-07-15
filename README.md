# Tardigrade

A Next.js app for rubric-based grading:

- Import rubrics, students, and grades.
- Grade students and groups against a grid's rubrics.
- Export grades as CSV.
- Track grading completion across a grid.

**Tardigrade**'s name is a play on the near-indestructible micro-animal + "grade".

## Tech Stack

- Next.js 16 (App Router) + React 19
- Mantine v9
- PostgreSQL
- Kysely (query + migrations)
- Vitest (unit, integration, and Storybook tests) + Playwright (end-to-end)
- Biome (format/lint)

## Prerequisites

- Node.js 26+
- pnpm 11+
- Docker (for local PostgreSQL and containerized tests)

## Quick Start

Local development environment variables are committed in [`.env.development`](.env.development) and loaded automatically through dotenvx, so no environment setup is needed. To override a value, create a gitignored `.env.local` (or `.env.development.local`) at the repository root — dotenvx's flow convention gives those files precedence.

1. Install dependencies.

```bash
pnpm install
```

2. Start PostgreSQL.

```bash
pnpm db:up
```

3. Run database migrations.

```bash
pnpm db:migrate:up
```

4. Start the app.

```bash
pnpm dev
```

5. Open http://localhost:3000.

When finished:

```bash
pnpm db:down
```

## Development Commands

### App and UI

```bash
pnpm dev                            # Start the Next.js development server.
pnpm build                          # Build the production app.
pnpm start                          # Start the built production app.
pnpm storybook                      # Start Storybook locally.
pnpm storybook:build                # Build the static Storybook site.
pnpm storybook:browser:install      # Install the Chromium browser used by Storybook tests.
```

### Quality

```bash
pnpm check                          # Check formatting and linting with Biome.
pnpm check --fix                    # Format and lint with Biome, applying safe fixes.
pnpm check-types                    # Run TypeScript type checks.
pnpm test                           # Run the default test suite.
pnpm test:unit                      # Run unit tests only.
pnpm test:integration               # Run integration tests only.
pnpm test:storybook                 # Run Storybook component tests only.
pnpm test:watch                     # Run tests in watch mode.
pnpm test:e2e                       # Run the Playwright end-to-end smoke test.
pnpm lint:boundaries                # Check layer boundaries with dependency-cruiser.
```

See [Running integration tests](docs/guides/running-integration-tests.md) for local and CI database behavior. `pnpm test:e2e` needs a production build first (`pnpm build`) and Docker for its ephemeral PostgreSQL; see [Testing conventions](docs/reference/testing-conventions.md) for the full test-tier map.

### Database

```bash
pnpm db:up                          # Start the local PostgreSQL container.
pnpm db:down                        # Stop the local PostgreSQL container.
pnpm db:logs                        # Show local PostgreSQL logs.

pnpm db:migrate:status              # Show migration status.
pnpm db:migrate:up                  # Apply pending migrations.
pnpm db:migrate:down                # Roll back the latest migration.
pnpm db:reset                       # Reinitialize the local DB without applying migrations.
pnpm db:types:generate              # Regenerate database types.
```

## App Workflow

1. Open the home page at `/` — it redirects to your first grid's Overview, or to `/grids` if none exist yet.
2. Create or open a Grid.
3. Use **Import** to load Rubrics, Students, and optionally Grades.
4. Grade students and groups, by student/group or by rubric.
5. Open **Results** for the Grades table and the Analytics breakdown.
6. Use **Export** to download grades as CSV.

## Conventions

- **Domain terminology** (internal/dev-facing): [CONTEXT.md](CONTEXT.md) is the canonical glossary — read it before changing domain terms, identifiers, or contracts.
- **User-facing vocabulary** (UI labels, headings, messages): [docs/reference/lexicon.md](docs/reference/lexicon.md) is the canonical word list — check it before writing new UI copy.
- **URL structure**: [docs/reference/url-conventions.md](docs/reference/url-conventions.md) documents the route tree and its ID/slug segments.
- **Issue, PR, and label conventions**: [docs/guides/issue-and-pr-conventions.md](docs/guides/issue-and-pr-conventions.md) owns the detailed templates, label guidance, and planning notes.
- **Full documentation map**: [docs/index.md](docs/index.md) indexes every ADR, investigation, design doc, and reference doc in the repo.

## Import Formats

### Rubrics YAML

```yaml
rubrics:
  - id: r1
    label: Rubric 1
    criteria:
      - id: c1
        kind: check
        label: Correctness
        marks: 2

      - id: c2
        kind: options
        label: Quality
        marks:
          poor: 0
          good: 1
          excellent: 2

      - id: c3
        kind: number
        label: Value
        minValue: 0
        maxValue: 10
        minMarks: 0
        maxMarks: 5
```

Rules:

- `rubrics` is required and must contain unique rubric ids.
- Each rubric requires `id` and `criteria`.
- Criterion ids must be unique across the whole grid, not just within one rubric — persistence conflicts on `(gridId, id)`, so reusing an id across two rubrics passes this parser but fails on save.
- Check criterion: `marks` is the number of marks awarded for a Yes answer. `falseMarks` (optional) sets marks for a No answer (defaults to `0`).
- Options criterion: `marks` must contain at least 2 label/mark entries (label to numeric marks).
- Number criterion:
  - At least one of `minMarks` or `maxMarks` must be provided.
  - When only `maxMarks` is given, `minMarks` defaults to `0` and `maxMarks` must be `> 0`.
  - When only `minMarks` is given, `maxMarks` defaults to `0` and `minMarks` must be `< 0`.
  - `minValue` defaults to `0`, `maxValue` defaults to `1`. If `minValue` is provided, `maxValue` must also be provided.
  - `reversed` (optional boolean): reverses the value-to-marks mapping direction.
  - Final values must satisfy `minMarks <= maxMarks` and `minValue < maxValue`.
- Unrecognized top-level keys and unrecognized criterion fields are rejected, so a stale file (e.g. an old `questions:` export) fails loudly instead of importing silently with fields dropped.

### Students CSV

```csv
last_name,first_name,id,group
Doe,John,john_doe,
Smith,Jane,jane_smith,
Johnson,Bob,bob_johnson,Group A
```

Rules:

- Required columns: `last_name`, `first_name`, `id`.
- Optional column: `group`.
- Empty `group` means an individual grade target.
- Same `group` groups students into one grade target.

### Grades CSV

```csv
kind,name,r1:c1,r2:c2
individual,jane_smith,,
individual,john_doe,true,good
group,Group A,false,excellent
```

Rules:

- Required columns: `kind`, `name`.
- `kind` must be `individual` or `group`.
- `name` matches a row to its grade target: for a `group` row, the group's name; for an `individual` row, the student's roster `id` (not the student's display name — student names aren't guaranteed unique, but roster ids are).
- Grade columns use `rubricId:criterionId`.
- For export/import round-trip, export must include grade columns (`rubricId:criterionId`). Marks-only exports (`rubricId:criterionId:marks`) do not contain importable grades.
- Values by criterion kind:
  - Check: `true` or `false`
  - Options: one of the criterion's labels
  - Number: a numeric value
- Empty grade cells are ignored.
- Unknown columns are rejected.
- A row with no matching grade target blocks the entire import — nothing is written until every row matches.
- Export-only columns like rubric totals (`rubricId:total`), `:marks` columns, and `final_total` are allowed and ignored on import.

## Notes

- Environment variables are loaded through dotenvx in package scripts. Local development defaults live in `.env.development`; override them in a gitignored `.env.local` or `.env.development.local`.
- Database migrations are handled by Kysely in `src/db/migrate.ts`; see [Database migrations](docs/reference/database-migrations.md) for migration conventions.
- Storybook component tests run with the normal Vitest suite via `pnpm test`; use `pnpm test:storybook` for the Storybook project alone.
