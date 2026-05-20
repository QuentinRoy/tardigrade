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
- Vitest
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
pnpm test:unit
pnpm test:integration
pnpm test:watch
```

Integration test database behavior:
- `test:integration` runs `vitest --project=integration` directly.
- Both local and CI integration tests use the same DB contract: `TEST_DATABASE_URL`.
- Local default (no `TEST_DATABASE_URL` set): Vitest global setup starts an isolated Docker Compose Postgres service, runs tests, then tears down containers/networks/volumes.
- CI: GitHub Actions provides a Postgres service container and sets `TEST_DATABASE_URL`, so global setup skips Docker Compose startup.

Summary:
- Same test command and same connection contract in all environments.
- Different orchestrators (local Docker Compose vs CI service containers).

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres \
pnpm test:integration
```

If Docker is unavailable and `TEST_DATABASE_URL` is not set, integration tests will fail during global setup.

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

## GitHub Issue and PR Conventions

Issues and pull requests should be structured enough to support safe review and agent-assisted work without adding unnecessary process overhead.

### Issues

Use the repository issue templates when creating issues:

- **Bug report**: broken behavior or regressions. Automatically applies `bug`.
- **Feature request**: new capabilities or workflow improvements. Automatically applies `feature`.
- **Task / Investigation**: planned work, technical debt, refactoring, or questions to investigate before implementation.
- **Blank issue**: uncategorized notes, discussions, or edge cases that do not fit the structured templates.

Prefer the structured templates when they fit. Use blank issues as an escape hatch, not as the default path around the templates.

Issue descriptions should capture the problem, intended behavior, and completion criteria before implementation work starts. Not every issue needs every section. Small bugs can be shorter. Larger features, reliability work, migrations, data-model changes, or UX changes should include enough context to make the intended scope and risks clear.

Distinguish investigation issues from implementation issues:

- Investigation issues should compare options, clarify constraints, document a recommendation, and create follow-up implementation issues when appropriate.
- Implementation issues should define the behavior to build or fix, the relevant scope, and testable acceptance criteria.

### Pull requests

Implementation PRs should usually reference or close an issue. Use `Fixes #...` or `Closes #...` when the PR completes the issue, and use `Related to #...` when it only contributes partial work or documentation.

Prefer this PR structure:

```md
## Summary

## Related issue

Fixes #

## Plan

- Plan file:
- User validated plan: yes / explicit bypass / not applicable

## Changes

## Validation

- [ ] pnpm run check --fix
- [ ] pnpm run check-types
- [ ] Focused tests:
- [ ] Integration tests if DB/import/export/routing behavior changed:

## Risk review

- [ ] No existing migration was modified
- [ ] Project isolation considered
- [ ] Data-loss/destructive behavior considered
- [ ] User-visible errors remain actionable
- [ ] Docs/import/export contracts updated if affected

## Notes
```

Adapt the checklist to the PR. Documentation-only PRs do not need code validation commands unless they touch executable examples, workflow files, or other checked artifacts.

For code-change tasks, follow the repository agent instructions: create and validate a plan markdown file before editing unless the user explicitly opts out. The PR should link the plan file or state why no plan was needed.

### Labels

Labels should make triage and review easier. Apply labels to both issues and PRs when useful. Issue templates apply some type labels automatically, but additional labels may still be useful.

Use existing labels whenever they describe the work well enough. Do not introduce new labels lightly, and do not create a new label when an existing label would already do the job. Add a new label only when it represents a recurring distinction that will meaningfully improve triage, filtering, or review.

Use labels along these dimensions:

- Type: what kind of work this is, such as `bug`, `feature`, `refactor`, `documentation`, or `investigation`.
- Area: which part of the project is affected, such as `ui`, `rubrics`, `assessments`, `import`, `export`, `database`, `projects`, `ci`, `testing`, `accessibility`, or `mobile`.
- Risk or priority: whether special review is needed, such as `reliability`, `tier-0`, `tier-1`, `security`, or `data-loss-risk`.
- Process state: whether the work is blocked, needs design, or needs review.

A typical issue or PR should have one type label when possible, one or more area labels when useful, and risk labels only when the work affects correctness, data integrity, migrations, destructive actions, authentication, security, or grading results.

Examples:

- Touch interaction bug in rubric editing: `bug`, `ui`, `rubrics`, `mobile`.
- Import/export round-trip correctness issue: `reliability`, `testing`, `import`, `export`.
- Documentation architecture investigation: `documentation`, `investigation`.
- CI branch protection or workflow change: `ci`, `testing`.

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
