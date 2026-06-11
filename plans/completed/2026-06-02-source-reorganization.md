# Plan: reorganize source ownership before further splitting

Status: Completed
Date: 2026-06-02
Completed: 2026-06-02
Related: #115, ADR 0002, docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md

## Outcome

All six steps landed in a single PR (#137) on `refactor/source-reorganization`
as sequential behavior-preserving commits (`db93bbd`, `4923c12`, `1c81efc`,
`d188467`, `55a6bc0`, `5fe7c6f`), rather than the per-step PRs the original
"Suggested PR sequence" below proposed. Feature-owned persistence,
read models, and feature-facing types now live in `src/projects`, `src/submissions`,
`src/questions`, `src/assessments`, and `src/rubrics`. `src/db/types.ts` was deleted
(no shim), and `src/db` is back to database infrastructure only: `kysely.ts`,
`generated/`, `migrations/`, `migrate.ts`, `cacheTags.ts`, `projectScope.ts`, plus
the `constraints` and `migrations` integration tests. `src/shared` was renamed to a
flat `src/ui`. All moves were behavior-preserving; checks and affected tests stayed
green. ADR 0002 ownership now matches across the source tree, so future splitting
can happen in the owning feature folder rather than under `src/db`.

## Goal

Move feature-owned persistence and read-model files out of `src/db` before doing more fine-grained file splitting.

This is a behavior-preserving source reorganization plan. The goal is to make ownership match ADR 0002 so that future splits happen in the right location.

## Motivation

ADR 0002 defines `src/db` as database infrastructure. The current tree still contains feature-owned persistence, read models, domain-facing types, and tests under `src/db`.

Splitting and reorganization are related but distinct:

- reorganization changes ownership and import direction;
- splitting changes local responsibility boundaries inside an owner.

If we split files while they are still under `src/db`, we can improve local structure while preserving the wrong ownership boundary. This plan therefore moves files first and leaves deeper splitting for later PRs.

## Non-goals

This plan does not include:

- query rewrites;
- new abstractions such as repository/service layers unless required by the move;
- terminology changes;
- import preview UI;
- cache policy redesign;
- behavior changes;
- moving route files out of `app`;
- making `src/db/generated/db.ts` a general-purpose feature import surface.

## Target ownership

`src/db` should keep database infrastructure only:

```txt
src/db/
  kysely.ts
  generated/
  migrations/
  migrate.ts
  cacheTags.ts
  projectScope.ts
```

`cacheTags.ts` and `projectScope.ts` are acceptable to keep temporarily because they are infrastructure-adjacent helpers. They can be revisited after the main feature-persistence moves.

Feature folders should own their persistence and read models:

```txt
src/projects/
  projects.ts
  projectPaths.ts
  canonicalProjectRedirect.ts

src/submissions/
  submissions.ts
  types.ts
  getSubmissionLabel.ts
  quickJumpSearch.ts

src/questions/
  questions.ts
  questionDefinitions.ts
  questionDefinitionMutations.ts
  types.ts
  schemas.ts
  actions.ts

src/assessments/
  assessments.ts
  assessmentMutations.ts
  assessmentsProgress.ts
  submissionProgress.ts
  rubricOverview.ts
  rubricOverviewBuilder.ts
  assessmentSummary.ts
```

The assessment feature folder is named `src/assessments/` (plural) to stay
consistent with the other feature folders (`src/projects/`, `src/submissions/`,
`src/questions/`, `src/rubrics/`).

The names above intentionally stay close to current names. Renaming files such as `submissionProgress.ts` to `assessmentCompletionBySubmission.ts` may be worthwhile later, but should be separate from this mechanical move unless needed for clarity.

## Step 1: move project and submission persistence — Done

Status: Completed 2026-06-02.

Moved `src/db/projects.ts` -> `src/projects/projects.ts`, `src/db/submissions.ts` ->
`src/submissions/submissions.ts` (with its integration test), and the `Submission` /
`SubmissionSubmitter` / `SubmissionType` feature types out of `src/db/types.ts` into
`src/submissions/types.ts`. Updated all consumer imports across `app/` and `src/`.
`src/db/rubricOverview*.ts` still live under `src/db` (they move in Step 3) but now
import submissions from their new feature-folder locations.


Move:

```txt
src/db/projects.ts -> src/projects/projects.ts
src/db/submissions.ts -> src/submissions/submissions.ts
```

Move tests if present or add integration-test relocation when applicable:

```txt
src/db/submissions.integration.test.ts -> src/submissions/submissions.integration.test.ts
```

Also move feature-facing submission types out of `src/db/types.ts`:

```txt
Submission
SubmissionSubmitter
```

to:

```txt
src/submissions/types.ts
```

Keep behavior unchanged. Update imports only.

## Step 2: move question persistence — Done

Status: Completed 2026-06-02.

Moved `src/db/questions.ts`, `src/db/questionDefinitions.ts`, and
`src/db/questionDefinitionMutations.ts` (with their integration tests) into
`src/questions/`. Moved the `Question`, `Grid`, and `QuestionDefinition` feature
types out of `src/db/types.ts` into `src/questions/types.ts`. Updated all consumer
imports across `app/` and `src/`, including the `vi.mock` path in
`src/questions/actions.test.ts`. `src/db/generated/db.ts` stays private to DB
infrastructure. Behavior unchanged; unit tests green.

Move:

```txt
src/db/questions.ts -> src/questions/questions.ts
src/db/questionDefinitions.ts -> src/questions/questionDefinitions.ts
src/db/questionDefinitionMutations.ts -> src/questions/questionDefinitionMutations.ts
```

Move tests with the files:

```txt
src/db/questions.integration.test.ts -> src/questions/questions.integration.test.ts
src/db/questionDefinitions.integration.test.ts -> src/questions/questionDefinitions.integration.test.ts
src/db/questionDefinitionMutations.integration.test.ts -> src/questions/questionDefinitionMutations.integration.test.ts
```

Move feature-facing question types out of `src/db/types.ts`:

```txt
Question
Grid
QuestionDefinition
```

to:

```txt
src/questions/types.ts
```

Keep `src/db/generated/db.ts` private to DB infrastructure. Do not expose raw generated row types as question feature contracts.

## Step 3: move assessment persistence and read models — Done

Status: Completed 2026-06-02.

Moved `assessments.ts`, `assessmentMutations.ts`, `assessmentsProgress.ts`,
`submissionProgress.ts`, `rubricOverview.ts`, and `rubricOverviewBuilder.ts` (with the
`assessments`, `submissionProgress`, and `rubricOverview` tests) from `src/db` into
`src/assessments/`. Moved the `AssessmentRubricValue` and `GlobalAssessmentProgress`
feature types out of `src/db/types.ts` into `src/assessments/types.ts`. Updated all
consumer imports across `app/` and `src/`, including the `vi.doMock` paths in the
relocated integration tests (`#db/kysely` and `#assessments/assessmentMutations` now
that the sources resolve `db` from `#db/kysely.ts`). `Rubric` stays in
`src/db/types.ts` for Step 4. Behavior unchanged; affected integration and unit tests
green, types clean.

The folder was later renamed from `src/assessment/` to `src/assessments/` (plural)
to match the other feature folders; all consumer imports were repointed from
`#assessment/` to `#assessments/`.

Move:

```txt
src/db/assessments.ts -> src/assessments/assessments.ts
src/db/assessmentMutations.ts -> src/assessments/assessmentMutations.ts
src/db/assessmentsProgress.ts -> src/assessments/assessmentsProgress.ts
src/db/submissionProgress.ts -> src/assessments/submissionProgress.ts
src/db/rubricOverview.ts -> src/assessments/rubricOverview.ts
src/db/rubricOverviewBuilder.ts -> src/assessments/rubricOverviewBuilder.ts
```

Move tests with the files:

```txt
src/db/assessments.integration.test.ts -> src/assessments/assessments.integration.test.ts
src/db/submissionProgress.integration.test.ts -> src/assessments/submissionProgress.integration.test.ts
src/db/rubricOverview.test.ts -> src/assessments/rubricOverview.test.ts
```

Move feature-facing assessment types out of `src/db/types.ts`:

```txt
AssessmentRubricValue
GlobalAssessmentProgress
```

to:

```txt
src/assessments/types.ts
```

Keep terminology stable for now. Use `assessment` rather than introducing `grading` names while terminology investigations are still open.

## Step 4: move rubric-facing types if needed — Done

Status: Completed 2026-06-02.

Moved the rubric feature types (`Rubric`, `RubricType`, `RubricForType`,
`AssessedRubric`) out of `src/db/types.ts` into a new `src/rubrics/types.ts`,
matching the per-feature `types.ts` convention used by the other layers.
`src/rubrics/rubric.ts` keeps the marking/assessment functions and imports those
types from `./types.ts`. `RubricType` is now a local literal union
(`"boolean" | "numerical" | "ordinal"`) instead of a re-export of the generated
enum, so `src/rubrics` no longer depends on `src/db/generated/db.ts` (keeps
generated DB types private per ADR 0002). Repointed all consumer imports across
`src/` from `#db/types.ts` to `#rubrics/types.ts` (type-only) or
`#rubrics/rubric.ts` (functions). With no feature-facing types left,
`src/db/types.ts` was deleted, which also satisfies Step 5. Behavior unchanged;
`check`, `check-types`, and affected unit tests green.

Move rubric feature-facing types out of `src/db/types.ts`:

```txt
Rubric
RubricType, if still re-exported for app code
```

to one of:

```txt
src/rubrics/rubric.ts
src/rubrics/types.ts
```

Prefer the existing `src/rubrics/rubric.ts` if it remains readable. Add `src/rubrics/types.ts` only if `rubric.ts` becomes too crowded.

## Step 5: remove `src/db/types.ts` as a feature-facing type source — Done

Status: Completed 2026-06-02 as part of Step 4. `src/db/types.ts` held only
rubric feature types, so once they moved to `src/rubrics/types.ts` the file had
nothing left and was deleted (no shim). No feature-facing types remain under
`src/db`.

After moving all feature-facing types, either delete `src/db/types.ts` or reduce it to DB-internal helper types only.

Do not keep a long-lived re-export shim from `src/db/types.ts` to feature folders, because ADR 0002 says `src/db` must not import feature modules.

A short-lived shim is acceptable only inside one PR if it makes the migration safer, and should be removed before the PR is merged if possible.

## Step 6: move shared UI separately — Done

Status: Completed 2026-06-02.

Moved all 14 files from `src/shared/` into a flat `src/ui/` (no nested technical
folders, per the implementation notes below; the nested `app-shell/`/`feedback/`/`code/`
grouping in the suggested moves was not used). Internal relative imports between the
moved files stayed valid; repointed the seven `#shared/` consumer imports across `app/`
and `src/` to `#ui/`. Behavior unchanged; `check`, `check-types`, and the moved
Storybook tests (AppShell, AppShellNavigationShell, CodeSnippet) green.

Move `src/shared` to `src/ui` in a separate PR from the persistence relocation.

Suggested moves:

```txt
src/shared/AppShell*.tsx -> src/ui/app-shell/
src/shared/AppShell*.ts -> src/ui/app-shell/
src/shared/SaveErrors*.tsx -> src/ui/feedback/
src/shared/CodeSnippet.tsx -> src/ui/code/CodeSnippet.tsx
src/shared/CodeSnippet.stories.tsx -> src/ui/code/CodeSnippet.stories.tsx
src/shared/shiki-setup.ts -> src/ui/code/shiki-setup.ts
src/shared/MuiNextLink.tsx -> src/ui/MuiNextLink.tsx
```

This is lower priority than moving feature persistence out of `src/db`, but it cleans up the historical `shared` bucket.

## Suggested PR sequence

1. Move project and submission persistence.
2. Move question persistence.
3. Move assessment persistence and read models.
4. Move remaining feature-facing types out of `src/db/types.ts` if not completed during the previous PRs.
5. Move shared UI to `src/ui`.
6. Reassess which relocated files still need internal splitting.

## Validation

Each PR should run the relevant checks after import updates.

Recommended checks:

```sh
pnpm check
pnpm test
```

If the full suite is too broad during development, at minimum run the moved file tests and any integration tests for the feature being moved.

## Notes for implementation agents

- Keep moves behavior-preserving.
- Prefer flat names over introducing nested technical folders.
- Do not combine reorganization with query rewrites.
- Do not make `src/db/generated/db.ts` a general-purpose feature type import.
- Keep route files in `app`.
- Keep tests colocated with the moved files.
- Update imports directly rather than adding barrel files.
