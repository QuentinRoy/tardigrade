# R-004 — Concurrency: prove write-path integrity under concurrent in-flight saves

Status: Done — [#211](https://github.com/QuentinRoy/grading/pull/211) (closes issue #20)
Created: 2026-06-22
Parent: `plans/completed/2026-05-17-reliability-hardening.md` (risk R-004, Tier 0, issue #20)

## Purpose

Prove that the write paths stay corruption-free when saves to the same target
run concurrently, and fix any race the proof exposes. This is a **test-and-fix**
task: write the race tests first; any violation they reveal is in scope to fix
(it is Tier 0 data integrity), not a spin-off.

What is real *today* is single-user optimistic-UI parallelism: the assessment
session hook fires saves in parallel as one grader clicks through a question's
rubrics, and a quick mind-change re-fires the same rubric. Multi-user grading is
future work. So this item is about **one grader's own in-flight saves not
corrupting or throwing** — not about adjudicating multi-user edit conflicts.

## Decisions locked (do not re-litigate)

1. **Test-and-fix**, not test-only. A happy-path-only test does not Verify a
   Tier 0 concurrency item.
2. **Two scenarios, opposite correct outcomes:**
   - **A — same `(submission, question, rubric)`:** last-write-wins. One value
     survives.
   - **B — same `(submission, question)`, different rubrics:** both rubric
     assessments must coexist; only the parent `assessment` grouping row is
     shared. This is the *more common* real race (optimistic UI saving several
     rubrics of one question in parallel) and the one most likely to expose the
     `INSERT … ON CONFLICT DO NOTHING` + separate `executeTakeFirstOrThrow`
     recovery pattern.
3. **Mechanism = forced interleaving via Kysely controlled transactions**
   (`db.startTransaction().execute()`, available in kysely 0.29.2). Pass the
   controlled-transaction handle into the *real* `saveAssessmentInDb` /
   `…ImportPlanInDb` functions (they already accept a `db` that may be a
   transaction) and control **commit order**. This drives the real code path
   unchanged and yields a deterministic outcome. A **lock-wait barrier** makes
   the contended interleaving fire every run (see "Test design" below).
   `Promise.all`-over-pool is demoted to a smoke check on the wrapper.
4. **Scope = three primitives, not four files.** `saveAssessmentInDb` is the
   deterministic, required core (it is shared by interactive grading *and*
   assessment import, so it subsumes grader×grader, grader×import, and
   import×import for assessments). `saveStudentImportPlanInDb` and
   `saveQuestionImportPlanInDb` are distinct primitives covered by lighter
   overlap-invariant tests.
5. **Count drift under overlap is an accepted non-goal.** Under READ COMMITTED,
   two overlapping imports can both classify the same row as "created," so
   reported `createdCount` / `updatedCount` / `overwriteCount` can drift while
   the rows themselves stay correct. Counts are advisory UI feedback, not a
   persisted invariant. The hard contract is row-level: no corruption, no thrown
   framework error, per-row last-write-wins, no partial cross-row state.
6. **Isolation strategy stays READ COMMITTED + constraint-based serialization.**
   No version columns, no `SELECT … FOR UPDATE`, no SERIALIZABLE — unless a test
   exposes a concrete violation. The multi-user concurrency *policy* decision
   (optimistic locking vs. pulling server changes into the client) is deferred
   to multi-user workflow; **no ADR now** (it would prematurely enshrine one
   answer).

## Schema facts (already verified)

- `assessment`: unique `(submissionId, questionId)` — the grouping/container row
  (`Assessment_submissionId_questionId_key`).
- `rubric_assessment`: unique `(assessmentId, rubricId)`
  (`RubricAssessment_assessmentId_rubricId_key`).
- each subtype table (`boolean_/ordinal_/numerical_rubric_assessment`): unique on
  `rubricAssessmentId`.
- Default Postgres isolation (READ COMMITTED); no explicit isolation anywhere.
- Integration test DBs use a real pool (`max: 5`), so genuine multi-connection
  concurrency is exercisable. Controlled transactions check out distinct
  connections.

## Assertion contract

**Required — timeless data-integrity invariants, independent of any concurrency
policy. Assert these:**

- No thrown error and no `{ success: false }` for a concurrency reason.
- Exactly one `assessment` grouping row for the `(submission, question)`.
- Exactly one `rubric_assessment` row per `(assessment, rubric)`.
- Exactly one subtype row of the correct type, and **no stale** rows of the other
  two subtypes.
- Scenario B: **both** rubric assessments survive — neither writer clobbers the
  other.
- The surviving value is **one of the submitted inputs** — never torn, blended,
  or null.

**Secondary — comment explicitly as "documents current behavior, not a committed
policy":** the specific last-write-wins winner (the transaction that commits last
wins). Keep for regression value, but flag it so whoever does multi-user knows it
describes today's behavior, not a contract to preserve.

## Test design

Place tests co-located with the module under test (per
`docs/reference/testing-conventions.md`), as `*.integration.test.ts`. Follow the
existing fixtures/patterns in
`src/assessments/assessmentMutations.integration.test.ts` (`createTestDb`,
`createProject`, `createAssessmentFixture`, `await using`).

### Assessment primitive (required, deterministic) — `saveAssessmentInDb`

Forced-interleaving shape:

1. `tx1 = await db.startTransaction().execute()`; run
   `saveAssessmentInDb(tx1, A)` fully (writes A, **not yet committed**).
2. `tx2 = await db.startTransaction().execute()`. Capture tx2's backend pid up
   front: `select pg_backend_pid()` on tx2.
3. Kick off `saveAssessmentInDb(tx2, B)` **without awaiting** — its grouping
   `INSERT … ON CONFLICT DO NOTHING` blocks on tx1's uncommitted unique tuple.
4. **Lock-wait barrier:** from a third (observer) connection, poll
   `pg_stat_activity` until tx2's pid shows `wait_event_type = 'Lock'`. This is a
   condition-poll, **not a sleep** — keep it deterministic and fast.
5. `await tx1.commit()`. tx2 unblocks, finishes; `await` it, then
   `await tx2.commit()`.
6. Assert the required invariants. Add the secondary winner assertion
   (commented).

- **Scenario A:** A and B target the same rubric with different values
  (e.g. boolean `passed: true` vs `false`). Expect one value survives; secondary:
  B wins (commits last).
- **Scenario B:** A and B target the same `(submission, question)` but different
  rubrics. Expect singular grouping row, no throw, **both** rubric assessments
  present.

### Import primitives (lighter, overlap-invariant)

For `saveStudentImportPlanInDb` and `saveQuestionImportPlanInDb`: run two
overlapping plan-writes (controlled transactions, commit order controlled) into
the same project and assert the **row-level** contract only — internally
consistent final state, per-row last-write-wins, no corruption, no thrown error.
Do **not** assert counts (accepted drift). Watch the
`studentToTeam` delete-then-reinsert (`saveStudents.ts:150`) and the rubric
delete+recreate on type change (`saveQuestions.ts`) — these are the spots most
likely to misbehave.

### Smoke check (lightweight)

Keep one `Promise.all`-over-pool test on the wrapper `saveAssessment` (which
opens its own transaction) asserting it does not error under naive parallelism.
This is a smoke check, not the authoritative proof.

## Expected outcome / watch list

Based on tracing the code, READ COMMITTED is **likely already correct** for the
assessment path — the grouping-row `INSERT … ON CONFLICT DO NOTHING` blocks on
the uncommitted unique tuple, and the follow-up `executeTakeFirstOrThrow` takes a
fresh snapshot that includes the committed row, so no throw is expected. If that
holds, the assessment work is test-only. The `studentToTeam` delete/reinsert is
the most plausible place to find an actual race. Either way, the tests settle it.

## Acceptance (Tier 0 Definition of Done)

- [x] Forced-interleaving integration tests for `saveAssessmentInDb` (Scenarios
      A + B) asserting the required invariants, with a deterministic lock-wait
      barrier. Added to `src/assessments/assessmentMutations.integration.test.ts`
      (co-located with the rest of the module's tests, per
      `docs/reference/testing-conventions.md`), using the shared helper
      `src/test/concurrency.ts`.
- [x] Overlap-invariant tests for the student and question import primitives
      (row-level contract; counts not asserted). Added to
      `src/import/saveStudents.integration.test.ts` and
      `src/import/saveQuestions.integration.test.ts`.
- [x] Any race the tests expose is fixed (test-and-fix); regression test fails
      when the invariant is intentionally broken. No race was found — all three
      primitives were already correct under READ COMMITTED. Verified test-and-fix
      validity by temporarily reverting each guard in turn (the assessment
      grouping insert's `ON CONFLICT DO NOTHING`, the `studentToTeam` delete in
      `saveStudents.ts`, the rubric recreate delete in `saveQuestions.ts`) and
      confirming the corresponding test fails, then restoring the guard.
- [x] `pnpm run check --fix`, `pnpm run check-types`, and the targeted
      `pnpm test src/...` integration suites green; CI `test-integration`
      (required gate) green locally (`pnpm test:integration`: 84/84 passing).
- [x] R-004 promoted to Verified with linked test files; dashboard counts and
      Change Log updated in the parent plan. Issue #20 will close via `Fixes #20`
      in the PR body once the PR is opened.

## Out of scope

- Multi-user concurrency policy (optimistic locking / server-pull sync) and any
  ADR for it — deferred to multi-user workflow.
- Accurate import counts under concurrent same-project imports.
- Any isolation-level change or explicit locking, unless a test forces it.
