# Server action, export route, and optimistic-save error/UX hardening

Status: Completed
Date: 2026-06-23
Resolution: Resolved — all three PRs merged: PR 2
([#219](https://github.com/QuentinRoy/grading/pull/219)), PR 3
([#220](https://github.com/QuentinRoy/grading/pull/220)), PR 1
([#221](https://github.com/QuentinRoy/grading/pull/221)). All four Tier 2 risks
(R-012, R-013, R-014, R-015) are Verified in the reliability tracker
(`plans/completed/2026-05-17-reliability-hardening.md`); milestones M6/M7 flipped
in the same change that landed PR 1.
Follow-up: None beyond the three PRs below.

## 1. Scope and traceability

Three pieces of work, tracked as risks in the reliability tracker
(`plans/completed/2026-05-17-reliability-hardening.md`, Section 4 risk register).
The `R-0XX` codes are that tracker's identifiers; they are meaningless without
it, so this plan spells out what each is and prose prefers the descriptive name.

| Tracker risk | GitHub issue | Work |
|---|---|---|
| R-012 | #31 | Consistent server-action error shaping (grading / question / import) |
| R-015 | #29 | Same rule applied to the projects page + per-feature message constants + contract tests |
| R-013 | #30 | Optimistic-save hook (`useAssessmentSession`) tests |
| R-014 | #28 | Export route contract tests + submissions-route error shaping |

All behavior changes below are implemented via `/tdd` (red/green; confirm GREEN
by reverting and observing RED).

## 2. Orientation for the implementer

- **Branch**: `claude/clever-shannon-fgxckr`. Working dir: `/home/user/grading`.
  Commit/push to that branch (per the repo's session rules).
- **Read first**: `AGENTS.md` (error-handling UX rules, avoid-abstraction, flat
  structure, `/tdd` for behavior changes, simplify pass), `CONTEXT.md` (domain
  language — no new term needed here), `docs/adr/0009` (scoped pino logging),
  `docs/reference/testing-conventions.md` (placement, Storybook hook-harness
  precedent, user-facing error assertions, message ownership).
- **How the grading save flow works today** (so the R-012 change makes sense):
  `SubmissionAssessmentClient.tsx` calls `saveAssessment` (`src/assessments/saveAssessment.ts`,
  a `"use server"` file) → `assessmentMutations.saveAssessment` opens a
  transaction and returns a `SaveAssessmentResult` (`{ success: true } | { success:
  false; error: string }`). Domain failures already return actionable strings
  from the `assessmentErrors` map. The client routes `result.error` into
  `useSaveErrors().addError` (`src/ui/SaveErrorsProvider.tsx`). The hook
  `useAssessmentSession` drives the optimistic update and pending accounting.
- **Run tests**: `pnpm test:unit <stem>` (node unit), `pnpm test:storybook <stem>`
  (browser play functions), `pnpm vitest run --project=integration <path>`
  (Postgres via Testcontainers). Always finish with `pnpm run check --fix` and
  `pnpm run check-types`.

## 3. Findings (premise corrections vs. the tracker)

- **Grading action already shapes domain errors.** The tracker said
  `saveAssessment` "re-throws DB/pool errors to the client with no recovery
  path". In fact it already returns actionable `SaveAssessmentResult` messages
  for domain failures. The only real grading-path gap is *thrown*
  infra/unexpected errors inside `db.transaction().execute(...)`, which reject
  uncaught into the client transition.
- **Question and import actions leak raw error text.** They catch unexpected
  errors but pass the raw `error.message` to the client and never log
  (`src/questions/errors.ts` `toQuestionsValidationError`; `src/import/actionUtils.ts`
  `toImportErrorState`).
- **Projects page has the same leak.** `app/projects/page.tsx`
  `toCreateProjectErrorMessage` embeds raw `error.message` and never logs.
- **Export routes are inconsistent.** The questions route shapes thrown errors
  into a `500 {error}` JSON body; the submissions route calls
  `createCsvSubmissionExport` with no catch, so a thrown export/DB error becomes
  an unhandled 500 with no shaped body and no log.

## 4. Cross-cutting design: the error-classification rule (and a trap)

The rule (decisions 3–4): in each feature's existing error function, classify the
caught error.

- **Recognized domain/validation error → keep its specific, actionable message.**
- **Anything else (unexpected/infra) → log under the feature's ADR-0009 scope and
  return a generic actionable message. Never surface raw `error.message`.**

**Trap — do not just flip "any non-`ZodError` → generic".** Several features
throw *domain* messages as bare `Error`, so a naive flip would swallow
user-actionable text (a regression, e.g. against the R-009 import contract).
Before changing a branch, make each feature's genuine domain errors a
*recognized type*:

- **Import**: blocking-diagnostic errors are the primary domain error and are
  currently bare `Error`s — `assessmentImportBlockedError` (`saveAssessments.ts:37`)
  and `questionImportBlockedError` (`saveQuestions.ts` ~line 403). Introduce a
  shared `ImportBlockedError extends Error` (new `src/import/importErrors.ts`),
  have both helpers construct it, and have `toImportErrorState` treat
  `ImportBlockedError` and `ZodError` as domain (keep message) and everything else
  as unexpected (log + generic). Audit `saveStudents.ts` for any user-facing
  domain message; type it the same way, otherwise its bare invariant `Error`s
  (e.g. "Failed to resolve student row…") correctly become generic + logged.
- **Questions editor**: domain failures already throw `QuestionsValidationError`
  (typed). The one bare-`Error` domain message on this path is
  `questionDefinitionMutations.ts:85` "Question id is required." (defensive; the
  zod schema already requires it). Route it through `QuestionsValidationError`
  (or confirm it is unreachable) before treating other `Error`s as generic. The
  "Rubric '…' could not be resolved." invariants (lines 265/283/304) are internal
  and *should* become generic + logged.
- **Note (adjacent, optional)**: `reorderQuestionsAction` (`src/questions/actions.ts:74`)
  has no try/catch at all — its `reorderQuestions` invariant `Error`s (lines
  495/525) throw uncaught to the client. Folding it into the same shaping is a
  small, reasonable add under R-012's "controlled failure paths"; flag to the
  reviewer rather than expanding silently.

## 5. Locked decisions

1. **Grading path**: wrap `saveAssessment` so thrown infra/unexpected errors are
   caught and converted to `{ success: false, error }` with a generic actionable
   message. Domain errors already covered.
2. **Catch site + logging**: catch at the `"use server"` boundary
   (`src/assessments/saveAssessment.ts`), log the raw error via
   `createLogger("assessments")` (`logger.error({ err: error }, "…")`, the
   `{ err }` shape pino serializes — see `src/db/kysely.ts:39`), return the
   generic message. Keeps `assessmentMutations` free of swallowing logic so the
   import path (which composes `saveAssessmentInDb` directly) still propagates
   throws for rollback.
3. **One consistent policy across all three actions** — see §4.
4. **Feature-local, same rule.** No shared cross-feature helper (cuts against
   ADR 0006 / avoid-abstraction). Each feature's existing error function gains
   the classify-and-shape branch.
5. **Optimistic-save hook tests**: new `useAssessmentSession.stories.tsx`
   Storybook harness + play functions (browser project), following
   `useSubmissionQuickJump.stories.tsx`. Inject a stub `saveRubric` backed by
   *deferred promises* so the play function resolves saves in a chosen order.
   (jsdom + `renderHook` rejected: not a direct dependency, and would not
   faithfully model `useOptimistic`/`startTransition`.)
6. **Export route tests**: node unit tests mocking the loaders, asserting
   404/400/200, headers, filename, content-type, cache-control for both routes.
   Add a try/catch to the submissions route so export/DB throws return a shaped
   500 JSON and log via ADR 0009, matching the questions route.
   (Integration-with-`{db}`-seam rejected: would widen route signatures purely
   for tests.)
7. **Projects page + message ownership**: apply the same rule to
   `app/projects/page.tsx` (log under the `projects` scope, no raw `error.message`
   for unexpected errors; keep the specific "Project name is required." message).
   Give each feature a co-located named messages constant (like `assessmentErrors`)
   instead of inline strings. Add contract tests asserting every surface's
   user-visible error is actionable and never leaks internal/framework text.

## 6. Proposed user-facing messages

Match the existing `assessmentErrors` tone (plain language + recovery step + "if
it persists, report"). Final wording is the implementer's call; keep recovery
guidance and avoid internal detail. Each lives in a per-feature named constant.

- Grading (extend `assessmentErrors` with `unexpected`): "Something went wrong
  saving this grade. Reload and try again. If this keeps happening, report this
  issue."
- Questions editor (new constant): "Something went wrong saving this question.
  Reload and try again. If this keeps happening, report this issue."
- Import (new constant): "Something went wrong during the import. Nothing was
  imported. Reload and try again. If this keeps happening, report this issue."
  (import is all-or-nothing, so "nothing was imported" is accurate).
- Projects (new constant; keep the existing specific name-required message):
  "Could not create the project. Reload the page and try again. If this keeps
  happening, report this issue."

## 7. Commit and PR conventions

- **Titles and the PR's top-level description stay self-explanatory.** Describe
  the actual change in plain terms. Do not put bare `R-0XX` risk codes or
  context-free issue numbers in a commit title or PR title.
- Follow `docs/guides/commit-message-conventions.md`: `<area>: <imperative
  summary>`.
- **The body carries the references.** In commit message bodies and PR
  descriptions, reference this plan
  (`plans/active/2026-06-23-tier2-action-route-ux-hardening.md`) and the
  reliability tracker, name the relevant code paths, and state where the `R-0XX`
  codes come from (the tracker's Section 4 risk register). Example body line:
  "Closes risk R-012 from the reliability tracker
  (`plans/completed/2026-05-17-reliability-hardening.md`); see this plan for the
  design."
- Include `Fixes #<issue>` auto-close keywords in the PR body for each addressed
  issue.

## 8. PR breakdown

### PR 1 — Consistent server-action error shaping (closes #31, #29)

Status: Completed ([#221](https://github.com/QuentinRoy/grading/pull/221)). The
implementation moved `createProjectErrorMessage.ts` into `src/projects/` rather
than `app/projects/` as originally sketched below — feature-owned per ADR 0002,
since it is domain logic rather than route composition.

Covers tracker risks R-012 and R-015, which share one rule (§4), so they land
together.

Edits:
- `src/import/importErrors.ts` (new): `ImportBlockedError extends Error`. Update
  `assessmentImportBlockedError`/`questionImportBlockedError` to throw it.
- `src/import/actionUtils.ts` (`toImportErrorState`): `ZodError` → prettify;
  `ImportBlockedError` → its message; otherwise log under `import` + generic
  message. Move the generic string into a co-located `importMessages` constant.
- `src/questions/errors.ts` (`toQuestionsValidationError`): keep
  `QuestionsValidationError` and `ZodError` branches; the trailing
  `error instanceof Error` branch → log under `questions` + generic message.
  Co-locate the generic string in a `questionsMessages` constant. Type or retire
  the "Question id is required." bare `Error` per §4.
- `src/assessments/saveAssessment.ts`: try/catch around the mutation; on throw,
  log under `assessments` + return `{ success: false, error: assessmentErrors.unexpected }`.
  Add `unexpected` to `assessmentErrors` (`assessmentMutations.ts`; it is module-
  local today — either export it or define the action message in `saveAssessment.ts`
  and keep a single source of the string).
- `app/projects/page.tsx` (`toCreateProjectErrorMessage`): log under `projects`;
  keep the name-required message; generic fallback otherwise (no raw
  `error.message`). Co-locate a `projectMessages` constant.

Tests (co-located per feature; assert the contract, not the exact prose where
possible — but do assert "no raw internal text" and "has a recovery step"):
- `src/import/actionUtils.test.ts`: ZodError → prettified; `ImportBlockedError`
  → its message preserved; generic `Error` → generic message + no leak.
- `src/questions/errors.test.ts`: `QuestionsValidationError` → field/form errors;
  `ZodError` → mapped; generic `Error` → generic formError + no leak.
- `src/assessments/saveAssessment` coverage for the thrown-error path → returns
  `{ success: false, error: <generic> }` and logs. (Inject a `db` whose
  transaction throws; `saveAssessment` already accepts `{ db }`.)
- Optionally a small integration test that a forced infra throw on the grading
  path yields a shaped result rather than an unhandled rejection.

TDD: each behavior change starts RED (assert the desired shaped/non-leaking
output), then GREEN; confirm GREEN by reverting the shaping and seeing RED.

Acceptance: no user-visible path returns raw `error.message` for an unexpected
error; every unexpected error logs once under the correct scope; all existing
domain/validation messages (including import blocking diagnostics) are unchanged.

### PR 2 — Optimistic-save hook tests (closes #30)

Status: Completed ([#219](https://github.com/QuentinRoy/grading/pull/219)).

Covers tracker risk R-013.

Edits:
- `src/assessments/useAssessmentSession.stories.tsx` (new). A `Harness` component
  calls `useAssessmentSession` with: 2–3 `initialRubrics` (mixed types — a
  boolean and an ordinal/numerical, built from `AssessedRubric`/`Rubric` in
  `src/rubrics/types.ts`), a `submissions` list, a `currentSubmissionId`, an
  injected `saveRubric` stub, and an `onError` spy. The stub returns a *deferred*
  promise per call (store `resolve` handles keyed by call) so the play function
  controls completion order. Render `pendingByIndex`, `savedRubrics`, and
  `optimisticRubrics` as text/roles the play function can query.

Stories (play functions, `storybook/test`):
- success: `assess` → optimistic value visible + pending=1 → resolve success →
  saved value committed + pending=0.
- failure rollback: `assess` → resolve `{ success: false }` → optimistic value
  reverts to saved, pending=0, `onError` called once with the error.
- out-of-order completion: two `assess` calls on different indices; resolve the
  second before the first; assert both indices settle with correct
  saved/pending state and counters never go negative.
- success-after-failure on the same index: pending accounting stays correct.

TDD note: these are characterization tests of existing hook behavior (no hook
behavior change expected). If a test reveals a real bug, fix under red/green.

Acceptance: pending counters are always ≥ 0 and return to 0; optimistic state
matches saved state after settlement; `onError` fires exactly on failure.

### PR 3 — Export route tests + submissions-route shaping (closes #28)

Status: Completed ([#220](https://github.com/QuentinRoy/grading/pull/220)).

Covers tracker risk R-014.

Config gotcha (must handle first): the unit Vitest project only globs
`src/**/*.{test,spec}.{ts,tsx,js,jsx}` (`vitest.config.ts`), but the routes live
under `app/`. Extend the unit project's `include` to also match
`app/**/*.{test,spec}.{ts,tsx}` so co-located route tests are discovered. (Keep
the integration glob unchanged.)

Edits:
- Submissions route (`app/projects/[projectId]/[projectSlug]/export/submissions/route.ts`):
  wrap the `createCsvSubmissionExport` call in try/catch → `500 {error}` JSON +
  log under `export` (matching the questions route). Behavior change → TDD.
- Route tests next to each route (`route.test.ts`): mock the loaders
  (`#projects/projects.ts` `loadProjectByPublicId`, plus `createCsvSubmissionExport`
  / `loadQuestionGrid` / `exportQuestionsToYaml`) with explicit per-file
  `vi.mock` (the repo keeps `next/cache` and similar doubles explicit per file).
  Build a `Request`/`NextRequest` and the `params` promise by hand.

Scenarios (both routes):
- project not found → 404 JSON `{ error }`.
- submissions: invalid query (force `parseExportOptions` to throw) → 400 JSON.
- happy path → 200 with correct `content-type`, `content-disposition` filename
  (dated, slug-based), and `cache-control: no-store` (submissions route).
- thrown export/DB error → 500 JSON `{ error }` (both routes, after the
  submissions-route fix) + a log assertion.

TDD: start RED on the submissions-route 500 shaping test; GREEN by adding the
catch; confirm by reverting.

Acceptance: both routes have identical status/headers contracts under
valid/invalid/error conditions; no unhandled rejection path remains.

## 9. Gotchas and notes

- `assessmentErrors` is currently module-local in `assessmentMutations.ts`; pick
  one home for the grading generic message and avoid duplicating the string.
- The import path composes `saveAssessmentInDb` directly (not `saveAssessment`),
  so the grading-action catch must stay in `saveAssessment.ts` — do not move
  swallowing into the mutation, or import rollback breaks.
- `createLogger` takes a closed `LogScope` union (`assessments`, `export`,
  `import`, `projects`, `questions`, …) — all needed scopes already exist.
- Storybook play functions run in a real browser (chromium), so React
  transitions/`useOptimistic` behave faithfully; use `waitFor` for async
  settlement, not fixed delays.
- After edits, run the simplify pass (`.agents/skills/simplify/SKILL.md`) over
  the changed code only.

## 10. Tracker bookkeeping (when each PR lands)

Update `plans/completed/2026-05-17-reliability-hardening.md` in the same PR:
- Flip the addressed risk(s) to `Verified` with linked test file(s) in Test
  Evidence; set Next Action to "None — keep evidence current if these modules
  move."
- Update Section 3 dashboard counts (Tier 2 open→verified) and overall totals.
- Add a Change Log entry; tick Section 12 checklist items.
- Mark milestones M6/M7 once all four are implemented/verified.
- When all four risks are Verified, move this plan to `plans/completed/` and set
  its Resolution.

## 11. Guidance consulted

- AGENTS.md (error-handling UX, avoid-abstraction, flat structure, `/tdd`,
  simplify pass).
- `docs/adr/0009` (scoped pino logging), `docs/adr/0006` (flat modules),
  `docs/adr/0007` (db seam), `docs/reference/testing-conventions.md`,
  `docs/guides/commit-message-conventions.md`,
  `docs/guides/issue-and-pr-conventions.md`.

## 12. Checks (per PR)

`pnpm run check --fix`, `pnpm run check-types`, plus the targeted tests matching
changed files (`pnpm test:unit <stem>`, `pnpm test:storybook <stem>`,
`pnpm vitest run --project=integration <path>` where relevant). Note in the PR
which checks ran, which did not, and any convention intentionally not followed.
