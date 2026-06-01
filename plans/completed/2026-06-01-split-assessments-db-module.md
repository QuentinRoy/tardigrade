Status: Completed
Date: 2026-06-01
Primary Goal: Behavior-preservingly split src/db/assessments.ts, with two deliberate behavior changes agreed in the grill session: a unified optional-transaction save command, and a fix for the assessment-import cache staleness gap.

# Split src/db/assessments.ts (Issue #117)

## Purpose

Split the overgrown src/db/assessments.ts read + write module into a read-model
module and a mutations module, mirroring the completed questions split. While
doing so, redesign the save command's transaction contract and close a latent
cache-invalidation gap on the import path.

This plan captures decisions agreed in the grill-with-docs session on 2026-06-01.

## Repository Guidance Consulted

- AGENTS.md
- CONTEXT.md
- docs/index.md
- docs/adr/0002-db-is-infrastructure-features-own-persistence.md
- docs/adr/0004-avoid-barrel-files.md
- docs/investigations/source-structure-and-tech-debt-audit.md (Finding 6)
- plans/completed/2026-05-29-split-questions-db-module.md (the precedent this mirrors)
- plans/active/reliability-hardening.md

## Agreed Decisions (and why)

These were each decided explicitly in the grill session. Do not silently revisit
them during implementation; use the Opportunistic Refactor Protocol below if a
decision looks wrong once coding starts.

1. **Location: interim split stays inside `src/db/`.**
   ADR 0002 says assessment persistence should ultimately live in `src/assessment/`
   (read model, write command, Domain Types, validation), leaving `src/db` as pure
   infrastructure. We are NOT doing that relocation here. We mirror exactly how the
   questions split was done: split by responsibility within `src/db/`, defer the
   physical relocation. The relocation to `src/assessment/` remains a tracked ADR-0002
   follow-up (see Out of Scope).

2. **Granularity: faithful coarse mirror of the questions split — two files.**
   The questions split produced just `questionDefinitions.ts` (read) +
   `questionDefinitionMutations.ts` (write), with validation and normalization helpers
   kept INLINE in the mutations file. assessments.ts is 406 lines — smaller than the
   527-line mutations file accepted as a single module — so minimal decomposition is
   justified. We do NOT extract separate validation / errors / repository modules.
   #117's finer sub-bullets predate both ADR 0002 and the questions split; the executed
   precedent (coarse) governs.

3. **`AssessmentRubricValue` stays in `src/db/types.ts`.** It is a Domain Type that
   ADR 0002 will eventually move to the feature, but that moves with the relocation,
   not now. Both new modules import it from `#db/types.ts`.

4. **No barrel / facade (ADR 0004).** Consumers import directly from the owning module.
   `assessments.ts` remains a real read module (not a thin re-export facade).

5. **#86 (assessment message centralization) deferred.** The `assessmentErrors` map
   stays inline in the mutations file. We are not extracting a messages module.

6. **Transaction contract redesigned now (NOT strictly behavior-preserving here).**
   Replace the two-function arrangement (`saveAssessment` + the exported
   persistence-internal `saveAssessmentWithDb`) with a single optional-transaction
   command `saveAssessment(params, opts?: { db?: AssessmentWriteDb })`. This removes the
   smell flagged in Finding 6 (exporting an internal tx helper only so import can reuse
   a transaction).

7. **Import cache staleness fixed now (deliberate behavior change).** See "Cache fix"
   below. Chosen approach: declare the existing bulk-import fallback tag on the read
   model — a one-line read-side change — rather than enumerating written pairs in the
   import write path.

## Background: why the cache fix is needed

Next cache tags are exact-match strings. `loadAssessment` caches its entries under
only the granular tag `assessments:${submissionId}:${questionId}`
(assessmentCacheTag). The assessment import action invalidates only the broad tags
`assessments` and `assessments:all`. Those do not match the granular tag, so after a
bulk assessment import the per-submission/question grading view (loadAssessment) can
serve stale data.

There is a documented convention in src/db/submissionProgress.ts:
`// "assessments:all" is busted only by bulk imports, not by individual saves.`
Every assessment-sensitive read model declares either `assessments` or
`assessments:all` as a coarse fallback — except `loadAssessment`, which declares only
the granular tag. The bug is that narrow omission. submissionProgress already follows
the correct pattern (granular per-question tag for individual saves + `assessments:all`
for bulk imports); loadAssessment must do the same.

Hard constraint that shapes the tx design: **cache invalidation must run after the
transaction commits, never inside it.** The interactive path already obeys this
(`updateTags` runs only after `db.transaction().execute(...)` returns). A command
called inside the import's transaction therefore cannot invalidate per-call — the
transaction owner must.

## Concrete File Change Map

New / changed source:

- src/db/assessments.ts — becomes the read module. Keeps `loadAssessment`. Apply the
  cache fix here. Remove all save-related code.
- src/db/assessmentMutations.ts (new) — `saveAssessment`, `SaveAssessmentParams`,
  `SaveAssessmentResult`, `AssessmentWriteDb`, the inline `assessmentErrors` map, and
  the inline per-type validation/persistence helpers.

Write-side call-site migrations (import path changes from `#db/assessments.ts` to
`#db/assessmentMutations.ts`, plus signature change for the import flow):

- src/assessment/saveAssessment.ts — the "use server" action wrapper. Imports
  `saveAssessment` + type `SaveAssessmentParams`. Retarget import; signature of the
  one-arg call is unchanged (opts is optional).
- src/import/saveAssessments.ts — currently `saveAssessmentWithDb(tx, assessment)` at
  ~line 350. Change to `saveAssessment(assessment, { db: tx })`. Retarget import.

Read-side call sites (NO change — they keep importing loadAssessment from
`#db/assessments.ts`):

- app/projects/[projectId]/[projectSlug]/assessments/submissions/[submissionId]/page.tsx
- app/projects/[projectId]/[projectSlug]/assessments/submissions/[submissionId]/questions/[questionId]/page.tsx

Tests:

- src/db/assessments.integration.test.ts — its `loadAssessmentsWithDb` helper imports
  `./assessments.ts` and destructures both `loadAssessment` and `saveAssessment`.
  After the split, import `saveAssessment` from `./assessmentMutations.ts`
  (`loadAssessment` stays on `./assessments.ts`). Optional cleanup: with the new
  `{ db }` option, save-path tests can pass the test db directly via
  `saveAssessment(params, { db })` instead of mocking `./kysely`.
- src/import/saveAssessments.integration.test.ts — currently mocks `../db/assessments`
  and overrides the `saveAssessmentWithDb` export (signature `(db, input)`) to inject a
  mid-transaction failure. Retarget the mock to `../db/assessmentMutations` and override
  the `saveAssessment` export with the new `(params, opts)` signature. The
  `saveAssessmentWithDbMock` helper param and its callers in that file change shape
  accordingly.

No schema/migration changes. No new modules beyond assessmentMutations.ts.

## Final Module Structure

- src/db/assessments.ts (read)
  - `loadAssessment(submissionId, questionId): Promise<AssessmentRubricValue[]>`
  - Cache declaration changes to:
    `cacheTags(assessmentCacheTag(submissionId, questionId), CACHE_TAGS.assessmentsAll);`
    (import `assessmentCacheTag` and `CACHE_TAGS` from `./cacheTags.ts`; this also
    replaces the current inline template-string tag with the helper.)

- src/db/assessmentMutations.ts (write)
  - Public: `saveAssessment(params, opts?: { db?: AssessmentWriteDb }): Promise<SaveAssessmentResult>`
  - Types: `SaveAssessmentParams`, `SaveAssessmentResult`, `AssessmentWriteDb`
  - Inline: `assessmentErrors`, per-type validate+write helpers, the context-resolution
    /validation currently in `saveAssessmentWithDb`.

## Save command: target shape

```ts
// src/db/assessmentMutations.ts
type AssessmentWriteDb = Kysely<DB> | Transaction<DB>;

// Performs all validation + persistence against the given queryDb. No cache work.
async function applySaveAssessment(
  queryDb: AssessmentWriteDb,
  params: SaveAssessmentParams,
): Promise<SaveAssessmentResult> {
  // exactly the current body of saveAssessmentWithDb (context resolution,
  // rubric/type validation, assessment + rubricAssessment upsert, per-type subtype
  // write + sibling-subtype deletes). Behavior-preserving; no logic changes.
}

export async function saveAssessment(
  params: SaveAssessmentParams,
  opts?: { db?: AssessmentWriteDb },
): Promise<SaveAssessmentResult> {
  // Caller-supplied transaction: caller owns commit AND cache invalidation.
  if (opts?.db) {
    return applySaveAssessment(opts.db, params);
  }

  // Standalone interactive path: own transaction, invalidate only after commit.
  const result = await db
    .transaction()
    .execute((tx) => applySaveAssessment(tx, params));

  if (result.success) {
    updateTags(
      assessmentCacheTag(params.submissionId, params.questionId),
      CACHE_TAGS.assessments,
      assessmentQuestionCacheTag(params.questionId),
    );
  }

  return result;
}
```

Key invariant (document it as a code comment on `saveAssessment`):
**a tx-accepting write command defers cache invalidation to the transaction owner; it
invalidates only on the standalone (own-transaction) branch.**

Do NOT add `assessments:all` to the standalone `updateTags` set — per the documented
rule, individual saves must not bust `assessments:all`. The standalone tag set is
exactly today's three tags. loadAssessment now refreshes on individual saves via the
granular tag, and on imports via the newly-declared `assessments:all`.

## Cache fix

- Read side only: loadAssessment declares `CACHE_TAGS.assessmentsAll` in addition to
  the granular tag (see Final Module Structure).
- Write side / import action: UNCHANGED. src/import/assessmentsImportAction.ts already
  calls `revalidateTag("assessments:all", "max")`, which now refreshes loadAssessment.
- No enumeration of written pairs. No changes to src/import/saveAssessments.ts cache
  behavior beyond the call-site signature change.

## TDD Execution Strategy

Strict vertical slices, RED then GREEN, mirroring the questions split.

Phase 1 — Baseline and safety net
- Capture current exported symbols of src/db/assessments.ts and the call-site map above.
- Run baseline: `pnpm run check --fix`, `pnpm run check-types`,
  `pnpm test src/db/assessments.integration.test.ts`,
  `pnpm test src/import/saveAssessments.integration.test.ts`.

Phase 2 — Read seam
- Slice A: move `loadAssessment` into the read module (file already named
  assessments.ts; remove save code from it). Existing read consumers unchanged.
- Acceptance: loadAssessment behavior/SQL/mapping unchanged; integration parity holds.

Phase 3 — Cache staleness (RED first)
- RED: add an integration test — after a bulk assessment import, loadAssessment for an
  affected (submission, question) returns the imported values (currently would be stale
  under caching). NOTE: integration tests must exercise the actual tag mechanism; if the
  test harness does not run Next caching, assert instead that loadAssessment declares
  `assessments:all` and that the import action invalidates it (test at the seam that is
  observable). Pick the observable seam available in this suite.
- GREEN: add `CACHE_TAGS.assessmentsAll` to loadAssessment's `cacheTags(...)`.

Phase 4 — Command seam + tx redesign
- Slice B: extract `applySaveAssessment` (the old saveAssessmentWithDb body, verbatim)
  and the new `saveAssessment(params, opts?)` into assessmentMutations.ts. Move types
  and the errors map.
- Acceptance: standalone `saveAssessment(params)` behaves exactly as before (same tx,
  same updateTags set). `saveAssessment(params, { db: tx })` runs in the supplied tx and
  performs NO cache invalidation.

Phase 5 — Call-site + test migration (same PR)
- Retarget src/assessment/saveAssessment.ts and src/import/saveAssessments.ts imports;
  change import call to `saveAssessment(assessment, { db: tx })`.
- Update both integration tests (mock retarget + destructure source) per the Change Map.
- Ensure no remaining importer references `saveAssessmentWithDb` or imports save symbols
  from `#db/assessments.ts`.

Phase 6 — Final verification (see gates).

## Required Test Coverage in This PR

- Read seam: loadAssessment parity (empty assessment, mixed rubric types, project
  isolation already covered — keep them green).
- Cache fix: import-then-load freshness (or the observable-seam assertion described in
  Phase 3 RED).
- Command seam: save parity for boolean / ordinal / numerical, invalid option, invalid
  score, out-of-range score, criterion-changed; the mid-transaction import failure path
  (the retargeted mock) still rolls back.
- Tx contract: `saveAssessment(params, { db: tx })` participates in the caller's
  transaction (failure in a later row rolls back earlier rows — already asserted by the
  import failure test).

## Verification Gates Before Completion

1. `pnpm run check --fix`
2. `pnpm run check-types`
3. `pnpm test src/db/`
4. `pnpm test src/import/`
5. `pnpm run build`

Invariant checks:
- No SQL migrations, no schema changes.
- No SQL/query semantic drift in loadAssessment or the save path.
- Standalone interactive save invalidates exactly the prior three tags (NOT
  assessments:all).
- No import remains for the removed `saveAssessmentWithDb`.

Manual checks:
- Grade a rubric interactively (boolean/ordinal/numerical), confirm save + immediate
  refresh on the question grading page and submission overview.
- Import assessments CSV, then open a graded submission's question page and confirm the
  imported values appear (no stale empty cells).

## Out of Scope Guardrails

Do not include:
- Relocation of assessment persistence to `src/assessment/` (ADR-0002 target). Tracked
  as a follow-up; not this PR.
- Moving `AssessmentRubricValue` out of `src/db/types.ts`.
- #86 message centralization / extracting an assessmentErrors module.
- Fine-grained validation/repository module extraction.
- Per-pair enumeration in the import write path.
- Any change to the import action's existing revalidateTag calls.
- Query optimization not required for parity.

## Follow-ups to file / track

- ADR-0002 relocation of assessment persistence to `src/assessment/` (mirrors the
  pending questions relocation).
- #86 assessment message centralization, once a second consumer or file-size pressure
  justifies it.
- Optional: an ADR recording the convention "tx-accepting write commands defer cache
  invalidation to the transaction owner." Decision in the grill session: capture as a
  code comment for now (interim code; the fallback-tag pattern is already documented in
  src/db/submissionProgress.ts). Promote to an ADR only if the convention spreads to
  other writers.

## Opportunistic Refactor Protocol

If an opportunistic refactor is discovered during implementation:
1. Pause at that point.
2. Run a focused grill: exact problem, why now vs follow-up, behavior-preservation risk,
   test/verification impact.
3. Proceed only after explicit approval.
4. Record the decision and scope adjustment in this plan before coding it.
