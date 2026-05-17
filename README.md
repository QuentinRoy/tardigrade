# Grading

A Next.js app for rubric-based assessment workflows:

- Import questions, students, and assessment values.
- Grade submissions by submission or by question.
- Export assessment data as CSV.
- Track overall grading progress.

## Tech Stack

- Next.js 16 (App Router) + React 19
- Material UI
- PostgreSQL
- Kysely (query + migrations)
- Vitest + Testcontainers
- Biome (format/lint)

## Prerequisites

- Node.js 22+
- pnpm 11+
- Docker (for local PostgreSQL and containerized tests)

## Quick Start

1. Install dependencies.

```bash
pnpm install
```

2. Create `.env` at the repository root.

```bash
POSTGRES_USER=grading
POSTGRES_PASSWORD=grading_dev_password
POSTGRES_DB=grading
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}
```

3. Start PostgreSQL.

```bash
pnpm db:up
```

4. Run database migrations.

```bash
pnpm db:migrate:up
```

5. Start the app.

```bash
pnpm dev
```

6. Open http://localhost:3000.

When finished:

```bash
pnpm db:down
```

## Development Commands

### App and UI

```bash
pnpm dev
pnpm build
pnpm start
pnpm storybook
pnpm storybook:build
```

### Quality

```bash
pnpm check --fix
pnpm check-types
pnpm test
pnpm test:watch
```

### Database

```bash
pnpm db:up
pnpm db:down
pnpm db:logs

pnpm db:migrate:status
pnpm db:migrate:up
pnpm db:migrate:down
pnpm db:types:generate

pnpm db:types:generate
```

## App Workflow

1. Open the home page at `/`.
2. Use **Import** to load Questions, Students, and optionally Assessments.
3. Open `/assessments` to grade by submission or by question.
4. Use **Export CSV** from the home page to download assessment data.

## Import Formats

### Questions YAML

```yaml
questions:
  - id: q1
    label: Question 1
    rubrics:
      - id: r1
        type: boolean
        label: Correctness
        marks: 2

      - id: r2
        type: ordinal
        label: Quality
        marks:
          poor: 0
          good: 1
          excellent: 2

      - id: r3
        type: numerical
        label: Score
        minScore: 0
        maxScore: 10
        minMarks: 0
        maxMarks: 5
```

Rules:

- `questions` is required and must contain unique question ids.
- Each question requires `id` and `rubrics`.
- Rubric ids must be unique within each question.
- Boolean rubric: `marks` is the number of marks awarded when true. `falseMarks` (optional) sets marks for a false result (defaults to `0`).
- Ordinal rubric: `marks` must contain at least 2 label/value pairs (numbers).
- Numerical rubric:
  - At least one of `minMarks` or `maxMarks` must be provided.
  - When only `maxMarks` is given, `minMarks` defaults to `0` and `maxMarks` must be `> 0`.
  - When only `minMarks` is given, `maxMarks` defaults to `0` and `minMarks` must be `< 0`.
  - `minScore` defaults to `0`, `maxScore` defaults to `1`. If `minScore` is provided, `maxScore` must also be provided.
  - `reversed` (optional boolean): reverses the score-to-marks mapping direction.
  - Final values must satisfy `minMarks <= maxMarks` and `minScore < maxScore`.

### Students CSV

```csv
last_name,first_name,id,team
Doe,John,john_doe,
Smith,Jane,jane_smith,
Johnson,Bob,bob_johnson,Team A
```

Rules:

- Required columns: `last_name`, `first_name`, `id`.
- Optional column: `team`.
- Empty `team` means individual submission.
- Same `team` groups students into one team submission.

### Assessments CSV

```csv
submission_type,submitter,q1:r1,q2:r2
individual,jane_smith,,
individual,john_doe,true,good
team,Team A,false,excellent
```

Rules:

- Required columns: `submission_type`, `submitter`.
- `submission_type` must be `individual` or `team`.
- Assessment columns use `questionId:rubricId`.
- For export/import round-trip, export must include rubric assessment columns (`questionId:rubricId`). Marks-only exports (`questionId:rubricId:marks`) do not contain importable assessment values.
- Values by rubric type:
  - boolean: `true` or `false`
  - ordinal: one of the rubric labels
  - numerical: numeric score
- Empty assessment cells are ignored.
- Unknown columns are rejected.
- Missing submissions are skipped.
- Export-only columns like question totals, `:marks`, and `grand_total_marks` are allowed and ignored on import.

## Notes

- Environment variables are loaded through dotenvx in package scripts.
- Db migrations are handled by Kysely in `src/db/migrate.ts`.
- Storybook component tests run with the normal Vitest suite via `pnpm test`; use `pnpm test-storybook` for the Storybook project alone.
