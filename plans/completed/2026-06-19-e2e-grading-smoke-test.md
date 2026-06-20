# Execution plan: end-to-end grading workflow smoke test

Status: Completed
Date: 2026-06-19
Resolution: All delivery steps landed on this PR — harness, fixtures, the spec, CI gating, and the testing-conventions update.
Follow-up: None

Tracks issue #183.

**No ADR by design.** The durable rationale (why a standalone runner, why a
production build, why the test DB is safe to destroy) lives as comments **inside
the harness and test files themselves**, so a reader meets the explanation where
they meet the code. This plan is the handoff brief; it is written to be acted on
cold, without the originating conversation. Durable run instructions move into
`docs/reference/testing-conventions.md` after the code lands.

## Goal

One narrow Playwright smoke test that drives a realistic happy-path grading
workflow through a real browser against a real Postgres, exercising the layers
that only integrate at runtime: browser UI, Next.js routes/server actions,
database persistence, cache invalidation, computed grading roll-ups, and import
and export behaviour. This is an acceptance/smoke test, not a UI regression
suite. Edge cases stay in unit and integration tests.

## Resolved design

| Decision | Resolution |
|---|---|
| Runner | Standalone `@playwright/test`, own `playwright.config.ts`, separate from the Storybook Vitest project. |
| App mode | Production `next build` + `next start`. `next dev` short-circuits the Next.js caches, so it would not exercise the cache-invalidation paths this test exists to prove. |
| Test database | Reuse the ephemeral Docker-Compose pattern from `src/test/integrationGlobalSetup.ts` (free port, throwaway compose project, `down -v` teardown) in a Playwright `globalSetup`. Self-contained locally; honour a pre-supplied `DATABASE_URL`. DB starts empty and migrated. |
| Data origin | All state created **through the UI** — no DB seeding. The only fixtures are the import payloads. |
| Imports | All three flows, in dependency order: questions (**YAML**), students (**CSV**), assessments (**CSV**). Assessment-import is the grade source; no manual grade entry. |
| Scenario | create project → import questions → import students → import assessments → assert **Assessment Completion** on the dashboard → reload (persistence) → export → assert the computed total. |
| Export | In scope, narrow: assert `grand_total_marks` for the two assessed submissions (hand-computed), not a full-file snapshot. |
| CI | **Gating.** Extend the existing `build` job: it already migrates and `next build`s against a Postgres service container, so it `next start`s the same build and runs Playwright in the same job. One build, no separate flaky job. |
| Selectors | Accessible-first (`getByRole` / `getByLabel`). `data-testid` only as a targeted escape hatch, with a comment; a missing accessible name is treated as a real a11y gap to fix. |
| Fixtures | Three small committed payloads under `e2e/fixtures/`: one team submission, one individual, one deliberately-unassessed individual (to make completion `2 / 3`, not a trivial all-complete state). |
| Assertion language | Use **"Assessment Completion"** and **"computed total"** in test names, helpers, and comments. Per `CONTEXT.md`, never "progress" or "submission progress". |

No `CONTEXT.md` change: the scenario uses existing glossary terms and adds no
domain language.

## Risks — both already cleared during planning

- **DB safety (highest stakes).** Verified that a pre-set `DATABASE_URL` overrides
  `.env.development` under `dotenvx --convention=flow`. Reproduce with:
  ```
  DATABASE_URL=postgresql://OVERRIDE_WINS@x/y \
    npx dotenvx run --convention=flow -- node -e 'console.log(process.env.DATABASE_URL)'
  # prints postgresql://OVERRIDE_WINS@x/y, not the .env.development value
  ```
  So spawning `next start` (and migrations) with `DATABASE_URL` set in the
  process env is safe; the dev DB is never touched. Record this finding as a
  comment in `globalSetup`.
- **Playwright version.** `playwright@^1.60.0` is already a devDependency and
  matches the CI image `mcr.microsoft.com/playwright:v1.60.0-noble`. Add
  `@playwright/test` pinned to the **same** `1.60.0`. If the pinned Playwright is
  ever bumped, bump the CI image tag in `.github/workflows/ci.yml` in lockstep.

## Confirmed app surfaces (selectors and routes)

Import UIs are **multiline text areas, not file inputs** (`src/import/BaseImportForm.tsx`).
The drag-to-fill helper only populates the textarea; the form field is the
textarea. So the test reads each fixture file and **fills** the field, then
clicks submit. Success renders an MUI `Alert severity="success"` (role `alert`).

| Step | Route | Fill target (label) | Submit button | Success |
|---|---|---|---|---|
| Create project | `/projects` | `Project name` (`getByLabel`) | `Create and switch` | redirect to dashboard `…/<id>/<slug>` |
| Import questions | `…/import/questions` | `Questions YAML` | `Import questions` | success `alert` |
| Import students | `…/import/students` | `Students CSV` | `Import students` | success `alert` |
| Import assessments | `…/import/assessments` | `Assessments CSV` | `Import assessments` | success `alert` |

While importing, the button label changes to `Importing...` and is disabled
(`SubmitButton` + `useFormStatus`) — wait for the success `alert` rather than the
button.

Dashboard (`app/projects/[projectId]/[projectSlug]/page.tsx`) renders
`GlobalAssessmentSummary` (`src/assessments/GlobalAssessmentSummary.tsx`): three
MetricCards titled **"Rubrics assessed"**, **"Questions assessed"**,
**"Submissions assessed"**, each showing `completed / total` as text. The
dashboard shows **completion only**, no numeric grade total — assert completion
here, assert the computed total via export. The cards have no individual
accessible name today; if `getByText` scoping proves ambiguous, the targeted
escape hatch is to add an accessible name (e.g. an `aria-label` / heading) to
`MetricCard`, not a bare `data-testid`.

Export is a CSV **GET route** (`app/projects/[projectId]/[projectSlug]/export/submissions/route.ts`),
path helper `projectExportSubmissionsPath`. Fetch it with Playwright's request
context (`page.request.get(url)`) and parse the body — this avoids browser
download-handling flakiness. Columns (`src/export/submissionExportCsv.ts`):
`submission_type`, `submitter`, optional per-rubric `q:r` and `q:r:marks`
columns (toggled by query params), a per-question total column named `<questionId>`,
and `grand_total_marks`. `grand_total_marks` and `<questionId>` are populated
**only when the submission is fully assessed**; otherwise blank.

## Fixtures and the worked example

Derive the three payloads from the in-app placeholders
(`src/import/constants.ts`) so they stay valid by construction.

`e2e/fixtures/questions.yaml`:
```yaml
questions:
  - id: q1
    label: Question 1
    rubrics:
      - id: r1
        type: boolean
        marks: 1
        falseMarks: 0
  - id: q2
    label: Question 2
    rubrics:
      - id: r2
        type: ordinal
        marks:
          excellent: 2
          good: 1
          poor: 0
```

`e2e/fixtures/students.csv` (one individual assessed, one individual left
unassessed, one team):
```
last_name,first_name,id,team
Doe,John,john_doe,
Smith,Jane,jane_smith,
Johnson,Bob,bob_johnson,Team A
```

`e2e/fixtures/assessments.csv` (columns are `questionId:rubricId`; jane_smith
intentionally omitted so completion is not trivially 100%):
```
submission_type,submitter,q1:r1,q2:r2
individual,john_doe,true,good
team,Team A,false,excellent
```

Hand-computed expectations (record this derivation as a comment beside the
assertions):

- Marks: `q1:r1` boolean → true=1, false=0. `q2:r2` ordinal → excellent=2, good=1, poor=0.
- `john_doe`: q1=1, q2=1, **grand_total_marks = 2**.
- `Team A`: q1=0, q2=2, **grand_total_marks = 2**.
- `jane_smith`: unassessed → q1/q2/grand_total_marks blank.
- Dashboard **Assessment Completion**: Submissions assessed **2 / 3**;
  Questions assessed **4 / 6**; Rubrics assessed **4 / 6**.

## Delivery steps

### 1. Harness skeleton (no scenario yet)

- [ ] Add `@playwright/test@1.60.0` (match the pinned `playwright`).
- [ ] `playwright.config.ts` at repo root: `testDir: "e2e"`; a single chromium
  project; `webServer` running `next start` (a build must already exist),
  `reuseExistingServer: !process.env.CI`; `trace: "on-first-retry"`,
  `video: "retain-on-failure"`; `retries: process.env.CI ? 2 : 0`.
- [ ] `e2e/globalSetup.ts`: provision ephemeral Postgres (reuse the
  `integrationGlobalSetup.ts` approach), run `db:migrate:up` against it, set
  `process.env.DATABASE_URL` to the ephemeral URL for the `webServer`; if a
  `DATABASE_URL`/`TEST_DATABASE_URL` is already supplied, use it and skip Docker.
  Comment the verified dotenvx-override finding here.
- [ ] `pnpm test:e2e` script wired through `dotenvx` like the other test scripts.
  Locally it must ensure a build exists (e.g. `next build && playwright test`, or
  document that `pnpm build` runs first); in CI the build is reused (step 4).
- [ ] Smoke the harness with a trivial `expect(page).toHaveTitle/URL` test that
  only loads `/projects`, to prove server boot + DB wiring before writing the
  scenario.

### 2. Fixtures

- [ ] Add the three files under `e2e/fixtures/` exactly as above.
- [ ] Add a small typed module of expected constants (`grand_total_marks` per
  submitter, completion tallies) with the derivation comment.

### 3. The smoke test (`e2e/grading-workflow.spec.ts`)

Single spec, accessible-first selectors, rationale comments inline:

- [ ] Create a project via the `/projects` form (`Project name` → `Create and
  switch`); assert redirect to the dashboard URL.
- [ ] Import questions: read `questions.yaml`, fill `Questions YAML`, click
  `Import questions`, wait for the success `alert`.
- [ ] Import students: same pattern with `Students CSV` / `Import students`.
- [ ] Import assessments: same pattern with `Assessments CSV` / `Import assessments`.
- [ ] On the dashboard, assert **Assessment Completion**: "Submissions assessed"
  reads `2 / 3` (and, if cheap, Questions `4 / 6`, Rubrics `4 / 6`).
- [ ] Reload the dashboard; assert the same completion persists (proves
  persistence + that the production cache invalidated after the import writes).
- [ ] Fetch the export via `page.request.get(projectExportSubmissionsPath(...))`;
  parse the CSV; assert `grand_total_marks` is `2` for `john_doe` and `2` for
  `Team A`, and blank for `jane_smith`.
- [ ] Only if an accessible-name selector is genuinely unavailable, add the
  accessible name to the component (preferred) or a commented `data-testid`.

### 4. CI integration (gating, reuse the build)

- [ ] In `.github/workflows/ci.yml`, extend the existing `build` job: after
  `next build`, start the app (`next start` in the background against the
  service-container `DATABASE_URL`, wait for ready) and run `pnpm test:e2e`
  pointed at it (no rebuild). Keep `DATABASE_URL` = the service container.
- [ ] Ensure the job's outcome still feeds `ci-status` so the E2E result gates
  merges.
- [ ] Upload the Playwright HTML report / traces as an artifact on failure.
- [ ] Run inside the `mcr.microsoft.com/playwright:v1.60.0-noble` container (as
  the `test-storybook` job does) so the browser is prebaked.

### 5. Documentation

- [ ] Update `docs/reference/testing-conventions.md`: the E2E tier exists, how to
  run it (`pnpm test:e2e`), the empty-migrated-DB contract, and the
  accessible-first selector convention. Do this **with** the implementation.

## Verification before handoff-complete

- [ ] `pnpm test:e2e` passes locally (Docker available).
- [ ] `pnpm run check --fix` and `pnpm run check-types` clean.
- [ ] Simplify pass over the new harness/test/fixtures per `.agents/skills/simplify`.
- [ ] CI `build` job green with the E2E step gating.

## Out of scope

- Replacing unit or integration tests.
- Manual/interactive grade entry through the grading grid (assessment-import
  stands in for grade entry here).
- Edge cases through the browser; large or brittle UI regression coverage.
- Any reliance on a developer's local database.
