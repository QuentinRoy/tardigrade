# Grading

## Prerequisites

- Node.js and pnpm
- Docker (for local Postgres)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create environment variables in `.env`:

```bash
POSTGRES_USER=grading
POSTGRES_PASSWORD=grading_dev_password
POSTGRES_DB=grading
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public
```

3. Start Postgres:

```bash
pnpm db:up
```

4. Apply migrations:

```bash
pnpm prisma:migrate:dev -- --name init
```

5. Generate Prisma client:

```bash
pnpm prisma:generate
```

6. Start the app:

```bash
pnpm dev
```

Stop Postgres when done:

```bash
pnpm db:down
```

## Useful Commands

Validate Prisma schema:

```bash
pnpm prisma:validate
```

Open Prisma Studio:

```bash
pnpm prisma:studio
```

View DB logs:

```bash
pnpm db:logs
```

## App Workflow

1. Open the import page in the app.
2. Paste/upload Questions YAML and Students CSV.
3. Submit import.
4. Grade papers from the grading pages.

## Import Data Formats

The import page expects two inputs:

1. Questions YAML
2. Students CSV

### Questions YAML

Top-level shape:

```yaml
questions:
  - id: question-1
    label: "Optional question label"
    rubrics:
      - id: correct-answer
        type: boolean
        description: "Optional description"
        label: "Optional display label"
        marks: 2

      - id: performance
        type: ordinal
        marks:
          bad: 0
          medium: 2
          good: 4

      - id: numerical-score
        type: numerical
        minScore: 0
        maxScore: 1
        minMarks: 0
        maxMarks: 6
```

Validation rules:

- `questions` must be an array.
- Question `id` is required and must be non-empty.
- Question `label` is optional; if provided it must be non-empty.
- Question ids must be unique.
- Each question must contain a `rubrics` array.
- Rubric ids must be unique within the same question.
- Rubric `description` and `label` are optional; if provided they must be non-empty.

Boolean rubric:

- `type` must be `boolean`.
- `marks` is required and must be a number >= 0.

Ordinal rubric:

- `type` must be `ordinal`.
- `marks` is required and must be a map of `label -> number`.
- Mark labels must be non-empty.
- All mark values must be numbers >= 0.
- At least 2 entries are required in ordinal `marks`.

Numerical rubric:

- `type` must be `numerical`.
- `minMarks` and `maxMarks` are optional individually, but at least one must be provided.
- If `minMarks` is omitted, it defaults to `0` and `maxMarks` must be > `0`.
- If `maxMarks` is omitted, it defaults to `0` and `minMarks` must be < `0`.
- After defaults, `minMarks <= maxMarks`.
- `minScore` defaults to `0` when omitted.
- `maxScore` defaults to `1` when omitted.
- If `minScore` is provided, `maxScore` must also be provided.
- `maxScore` can be provided without `minScore` (`minScore` then defaults to `0`).
- After defaults, `minScore < maxScore`.

### Students CSV

Header and sample rows:

```csv
family_name,first_name,id,team
Smith,Alice,s1001,
Johnson,Bob,s1002,
Williams,Carol,s1003,group-a
Davis,Dan,s1004,group-a
```

Validation rules:

- Required columns: `family_name`, `first_name`, `id`.
- Optional column: `team`.
- `family_name`, `first_name`, and `id` must be non-empty.
- Blank `team` values are treated as missing.
- Rows with the same `team` are grouped into the same paper.
- Rows without `team` are grouped as one paper per student id.
