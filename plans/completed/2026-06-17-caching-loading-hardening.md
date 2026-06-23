# Caching and loading hardening (#59)

Status: Completed
Date: 2026-06-17
Source: `docs/investigations/2026-06-11-caching-loading-audit.md` (#59); ADR 0008 (proposed); `docs/guides/nextjs-caching.md`
Umbrella issue: #59
PRs: tracked as sub-issues #155–#167 under #59 (see Tracking)

## Doc dependency and location

This plan ships together with the investigation, the proposed ADR 0008, and the Next.js caching guide in PR #154 (`docs/caching-loading-audit` → main), so their cross-references resolve atomically on merge. The new `docs/reference/cache-invalidation-map.md` follows in Phase 1 (PR2/PR3).

Integration steps, in order:

1. Merge PR #154 (investigation + ADR 0008 + guide + this plan).
2. Sub-issues are filed under #59 — one per PR below (#155–#167).
3. Run PR1 (Phase 0) to baseline the grading loop. The tag-registration rule is already decided — never depend on propagation (ADR 0008 rule 3).
4. Accept ADR 0008 (amended if needed) before any Phase 1 code lands, because Phase 1 enforces its rules.

## Tracking

Umbrella: #59. Each PR below is a native GitHub sub-issue of #59 (#155–#167), so #59 shows live progress. Keep this table, the sub-issue states, and #59 in sync: when a PR merges, tick its acceptance, close its sub-issue, and update the Status column here — mirroring the reliability audit's doc/issue sync ritual. **Revisit #59 after each step** to confirm its acceptance checklist advances and the sub-issue progress reflects reality.

| Step | Issue | Status |
| --- | --- | --- |
| PR1 | #155 | Done — #184 |
| PR2 | #156 | Done — #168 |
| PR3 | #157 | Done — #170 |
| PR4 | #158 | Done — #171 |
| PR5 | #159 | Done — #174 |
| PR6 | #160 | Done — #176 |
| PR7 | #161 | Done — #180 |
| PR8 | #162 | Done — #181 |
| PR9 | #163 | Done — #182 |
| PR10 | #164 | Done — #186 |
| PR11 | #165 | Done — #187 |
| PR12 | #166 | Done — #193 |
| PR13 | #167 | Done — #189 |

## Guidance consulted

- `CONTEXT.md` — **Project ID** (authoritative, public) vs **Project Row ID** (internal); domain terms used in the map below.
- ADR 0007 (DB Primitives take a `Kysely<DB>` handle; App-Level Wrappers own caching/invalidation; cached wrappers never receive a runtime handle) — the foundation this builds on.
- ADR 0008 (proposed: tags, lifetimes, invalidation policy) — the rules this plan executes.
- `docs/guides/nextjs-caching.md` — the four-layer model and the recipes the PRs follow.
- ADR 0004/0006 (no barrels, flat modules), `docs/guides/typescript-api-design.md` (named-object params).
- `docs/reference/testing-conventions.md` (test selection; helper-output tests, not Next-runtime tests).
- `docs/guides/issue-and-pr-conventions.md`, `docs/guides/commit-message-conventions.md`.

## Verified baseline (2026-06-17)

Confirmed in source at HEAD `89e3a0a`, so later phases need not re-derive it:

- `saveAssessment` invalidates coarse `assessments` on every interactive save with read-your-writes semantics (`updateTags`, `src/assessments/assessmentMutations.ts:297`). Coarse `assessments` is registered by four project-wide readers, so the grade→navigate loop is cold by construction (Finding 19).
- `questions:${questionId}` is a **dead tag**: registered by three readers, invalidated by no mutation (Findings 1, 17).
- The submission-overview page body has no `"use cache"` scope; only the question-specific page and the assessments index do (Finding 18). Quick-jump uses `router.push` (`src/assessments/SubmissionOverviewAssessmentClient.tsx:202`); the question page uses `prefetch` links (`src/assessments/SubmissionAssessmentClient.tsx:178`).
- Four readers omit `cacheLife`: `loadQuestionGrid`, `loadSubmissions`, `loadQuestionAssessment`, `loadSubmissionAssessments` (Finding 3).
- `#153` made `loadAssessmentCompletionRowsFromDb` a shared **primitive**, but the cached projections still call it independently, so there is no shared cached **entry** yet (Finding 8 still open).
- Page-level ad-hoc tag strings exist (`app/.../questions/[questionId]/page.tsx:58,103-106`; `app/.../assessments/page.tsx:43`) — not produced by `src/db/cacheTags.ts` (Finding 1).

## Measured baseline (PR1, 2026-06-19)

Measured against a production build (`next build && next start`) — dev mode does not exercise the Data Cache the same way (every `"use cache"` body re-executed on every request in `next dev`, even on an unchanged repeat request, so dev-mode query counts are not representative). Seeded a throwaway project (3 questions, 8 submissions, one pre-existing assessment) into the local dev Postgres for the run; the seed/cleanup scripts and the temporary per-query `console.log` added to `src/db/kysely.ts`'s `log` option were removed afterward — this measurement is the only lasting artifact, per PR1's "any throwaway instrumentation is removed" acceptance.

Method: drove the app with a real browser (Playwright), counting executed SQL statements between page loads/clicks via the temporary query log.

- **Cold first load** of the question-specific grading page (`.../submissions/{id}/questions/{id}`): 21 queries.
- **Warm repeat load of the same URL**: 5 queries, not 0. `loadQuestion` (via `loadQuestionRows`, PR6), `loadSubmissions`, and `loadQuestionAssessment` were cache hits (0 queries); the question-scoped progress read (`loadAssessedRubricCountsBySubmission`, tagged `assessments:question:{q}`) missed and re-ran its two queries. This is a real, if modest, gap: that scope's own cache entry does not stay warm as long as its siblings even with no intervening save — confirms part of Finding 19's class of problem (progress projections are the least stable reads on this page) but the cost here is small (2 cheap count queries, not a project-wide aggregate).
- **Submission-overview page** (`.../submissions/{id}`, Finding 18 — no page-level `"use cache"` wrapper): cold load 5 queries; an exact repeat of the same URL was a full hit (0 queries). Per-function caching works here even without a page-level scope; Finding 18's risk is about consistency/prefetch UX and the lack of one shared tag closure, not raw duplicate-query cost, at least at this project size.
- **Decisive test for Finding 19** (coarse `assessments` over-coupling): warmed submission-overview pages for two different submissions (0 queries on repeat visits to each). Saved an assessment for a third, unrelated submission. Immediately revisiting one of the two already-warm overview pages forced a full project-wide recompute (3 queries: all submission ids, all questions' rubric counts, all assessment counts project-wide) even though the visited submission was untouched by the save. **Confirms Finding 19 exactly**: `saveAssessment` busts the coarse `assessments` tag project-wide, and `loadAssessmentCompletionBySubmission` (registering that coarse tag) recomputes for everyone on the next visit, not just for the submission that was saved.

This baseline is what PR10 (decouple progress freshness from interactive saves) and PR11 (cached submission-overview sections) must not regress, and the bar they should clear: the decisive-test scenario above (save submission A, then visit submission B's overview) should no longer force a full project-wide recompute on B's visit.

## Measured baseline (PR13, 2026-06-20)

Finding 12 asked for measurement before any architecture change to the rubric overview (`loadRubricOverviewData`, `RubricAnalyticsTable`, `StudentMatrix`). Measured against a production build (`next build && next start`), same rationale as PR1: dev mode re-executes `"use cache"` bodies on every request. Seeded a throwaway project sized for a large class — 20 questions (one boolean rubric each), 200 individual submissions, ~90% of cells assessed (3606 rubric assessments) — into the local dev Postgres; the seed/cleanup scripts and the temporary `console.time` added to `loadRubricOverviewData` were removed afterward.

Method: `curl` for server-only timing/payload size; a throwaway Playwright script for real-browser navigation timing (`performance.getEntriesByType("navigation")`).

- **Server query time** (`loadRubricOverviewData`'s DB work, cold): 47 ms. **In-memory build** (`buildRubricOverviewData`, shaping the matrix): 2.5 ms. Negligible — at this scale, the DB and the build step are not the cost driver.
- **Cache behavior**: the cold load ran the query once; three subsequent warm loads ran it zero times (full cache hit), consistent with the rest of this plan's caching model.
- **Payload size**: ~3.2–3.4 MB decoded HTML for the page, compressing to ~205–224 KB over the wire (gzip). The matrix table (200 rows × 20+ columns) is the bulk of this.
- **Browser timing** (warm, repeated): `responseEnd` ~235–270 ms from navigation start; `domContentLoadedEventEnd - responseEnd` (DOM parse + layout/paint of the large table, no client JS — these are Server Components) ~14–22 ms. Total `loadEventEnd` ~250–295 ms warm, ~410 ms cold.
- **Conclusion**: at this realistic large-class scale, nothing here is slow enough to justify Finding 12's candidate refactors (splitting summary from matrix, virtualizing, a dedicated first-viewport projection). Query and build time are negligible; the warm round-trip is well under 300 ms; the large decoded size compresses well and isn't a real bottleneck at this scale. **Per Finding 12's "do not refactor blindly" framing: no refactor.** Revisit if a real project's scale meaningfully exceeds ~200 submissions × ~20 rubrics, since payload size scales with submissions × rubrics and would eventually dominate.

## Invalidation map (verified — Phase 1 promotes this to `docs/reference/cache-invalidation-map.md`)

The investigation carried a *candidate* map; this is the *current* map traced from call sites. `{sub}`/`{q}`/`{id}` are runtime ids.

### Mutations → tags

| Mutation | Primitive | Tags invalidated | Site |
|---|---|---|---|
| `saveAssessment` | `updateTags` (read-your-writes) | `assessments:{sub}:{q}`, `assessments:{sub}`, `assessments`, `assessments:question:{q}` | `assessmentMutations.ts:297` |
| `saveQuestionDefinition` | `updateTags` | `questions`, `assessments`, `assessments:all`, `assessments:question:{id}` (+ `assessments:question:{originalId}` if the id changed) | `questionDefinitionMutations.ts:439,446` |
| `deleteQuestionDefinition` | `updateTags` | `questions`, `assessments`, `assessments:all`, `assessments:question:{id}` | `questionDefinitionMutations.ts:482` |
| `reorderQuestions` | `updateTags` | `questions` | `questionDefinitionMutations.ts:552` |
| `createProject` | `revalidateTag(_, "max")` | `projects`, `projects:{projectId}` | `projects.ts:129` |
| `saveAssessments` (import) | `revalidateTag(_, "max")` | `assessments`, `assessments:all` | `saveAssessments.ts:89` |
| `saveQuestions` (import) | `revalidateTag(_, "max")` | `questions`, `assessments`, `assessments:all` | `saveQuestions.ts:421` |
| `saveStudents` (import) | `revalidateTag(_, "max")` | `submissions`, `assessments`, `assessments:all` | `saveStudents.ts:306` |

### Readers → tags registered

| Reader / cached scope | Tags registered | `cacheLife` | Site |
|---|---|---|---|
| `loadProjectList` | `projects` | 60s | `projects.ts:42` |
| `loadProjectByPublicId` | `projects`, `projects:{id}` | 60s | `projects.ts:58` |
| `loadQuestionRows` | `questions` | 1h | `questions.ts:268` |
| `loadQuestionGrid` | `questions` | **none** | `questions.ts:279` |
| `loadSubmissions` | `submissions` | **none** | `submissions.ts:102` |
| `loadQuestionAssessment` | `assessments:{sub}:{q}`, `assessments:all` | **none** | `assessments.ts:34` |
| `loadSubmissionAssessments` | `assessments:{sub}`, `assessments:all` | **none** | `assessments.ts:50` |
| `loadAssessmentCompletionBySubmission` | `submissions`, `questions`, `assessments` | 60s | `loadAssessmentCompletion.ts:126` |
| `loadAssessedRubricCountsBySubmission` | `submissions`, `questions`, `assessments:question:{q}`, `assessments:all`, `questions:{q}` *(dead)* | 60s | `loadAssessmentCompletion.ts:199` |
| `loadAssessmentCompletionSummary` | `submissions`, `questions`, `assessments` | 60s | `loadAssessmentCompletion.ts:261` |
| `loadRubricOverviewData` | `questions`, `submissions`, `assessments` | 60s | `rubricOverview.ts:11` |
| `QuestionHeaderSection` | `questions`, `questions:{q}` *(dead)* | inherits | `questions/[questionId]/page.tsx:58` |
| `SubmissionRubricSection` | `assessments:{sub}:{q}`, `assessments:question:{q}`, `questions:{q}` *(dead)*, `submissions` | inherits | `questions/[questionId]/page.tsx:102` |
| Assessments index section | `assessments` | inherits | `assessments/page.tsx:43` |

### Problems the map exposes

- **Dead tag** `questions:{q}`: 3 registrations, 0 invalidations. Decide its fate (Phase 1).
- **Coarse `assessments` over-coupling**: 4 project-wide readers register it; every `saveAssessment` busts it read-your-writes (Finding 19).
- **Missing `cacheLife`**: 4 readers (Finding 3).
- **Under-registration (must register full closure)**: the assessments index registers only `assessments` yet renders question order (`reorderQuestions` busts only `questions`); the two grading sections register narrower than they render. Since we never depend on tag propagation (Decision 1 / ADR 0008 rule 3), these are staleness bugs to fix in PR2 (Finding 17).
- **Project tag never registered by grading sections**: `QuestionHeaderSection` and `SubmissionRubricSection` compose `loadProjectByPublicId` but register no `projects`/`projects:{id}` tag; since propagation is never relied upon, register the project tag explicitly in PR2 (Finding 17).

## Decisions to lock (grill before/while executing)

1. **Tag-registration rule — decided (2026-06-17), not verified.** Never depend on nested tag propagation: it is undocumented and may be inconsistent, so every `"use cache"` scope registers the full tag closure (ADR 0008 rule 3, now unconditional). No propagation fixture; a positive empirical result would be unsafe to rely on. PR2 applies this rule.
2. **`questions:{questionId}` fate** — make it first-class (add a `questionCacheTag(id)` helper, register it, and invalidate it on save/delete/reorder/import), or delete it and rely on coarse `questions` until finer granularity is measured-necessary. No third "leave the raw string" option.
3. **Progress freshness policy** (Finding 19) — pick from: stop registering coarse `assessments` on completion reads (granular + `assessments:all` only); switch progress projections to `revalidateTag` (stale-while-revalidate); move progress under Suspense; or client-optimistic progress. Acceptance is behavioral (below), not which option.
4. **Coarse cross-project tags** stay for now (ADR 0008 rule 8); project-scoped tags are a later all-at-once migration, not part of this plan.
5. **`loadQuestion` load breadth** (Finding 6) — keep loading the whole project question-set per question (warms grading navigation, simpler) or add a `loadQuestionById` read model with a real per-question tag. Default to keeping the broad load; add the narrow model only if PR13-style measurement shows project-wide question loading is a real cost. Record the choice at the call site.

## Phases and PRs

Order preserves the investigation's "suggested implementation PR order". Each PR is independently shippable; correctness precedes performance. Per-step status and sub-issue links live in the Tracking table above.

### Phase 0 — baseline the grading loop (deferred: run before Phase 5)

The tag-registration rule is already decided (Decision 1 / ADR 0008 rule 3: full closure, never depend on propagation), so there is no propagation fixture and Phase 0 no longer gates the correctness phases. PR1 is therefore **deferred and run immediately before Phase 5 (PR10/PR11)**, not at the front: the baseline only feeds the performance phases, and measuring just before them keeps it fresh — a baseline taken ahead of PR2–PR9 would go stale. It keeps the "Phase 0" label only so phase numbering stays stable.

- **PR1 `cache: instrument the grading loop and baseline #59`** (Findings 18, 19).
  - Instrument the grade→navigate loop (cache hits/misses, query counts) across submissions on both grading pages; capture a baseline.
  - Confirm or refute Findings 18 and 19 against the measurement.
  - **Acceptance**: a baseline grading-loop measurement later phases must not regress; F18/F19 confirmed or refuted. Any throwaway instrumentation is removed, not maintained.
  - **Depends on**: nothing technically.
  - **Sequence**: run immediately before PR10/PR11 (Phase 5), so the baseline reflects the state the performance work starts from.

### Phase 1 — make cache behavior auditable

- **PR2 `cache: centralize tag factories`** (Finding 1). Make `src/db/cacheTags.ts` the only tag-string producer; add named helpers for every accepted scope; replace the ad-hoc strings in `app/.../assessments/page.tsx` and `app/.../questions/[questionId]/page.tsx`. Apply Decision 1 (every scope registers the full tag closure — fix the under-registered sections) and resolve Decision 2 here. Helpers compose only `cacheTags.ts`. **Acceptance**: no page-level or feature-module template literal builds a cache tag (grep-clean); every `"use cache"` scope registers the full closure for what it renders; tests assert helper output; the dead `questions:{q}` string is removed or made first-class per Decision 2. **Depends on**: nothing (the registration rule is decided).
- **PR3 `cache: document invalidation map`** (Finding 2). Promote the map above to `docs/reference/cache-invalidation-map.md`; wire ADR 0008 rule 7 (reviewers reject a caching change with a missing map entry). Fix the contradicted comment at `loadAssessmentCompletion.ts:17`. **Depends on**: PR2.
- **PR4 `cache: define per-tag-class freshness policy (updateTag vs revalidateTag)`** (Findings 11, 19). Introduce semantic invalidation helpers (`invalidateAssessmentSave`, `invalidateAssessmentImport`, `invalidateQuestionDefinitionSave`, …) that pick the primitive per tag class; wrappers/import actions call exactly one after commit. Encodes Decision 3. **Depends on**: PR2, PR3.

### Phase 2 — make cache lifetime deliberate

- **PR5 `cache: clarify core cache lifetimes`** (Finding 3). Add explicit `cacheLife` to the four readers that omit it (or document the omission); apply the policy classes from ADR 0008 rule 4 (`definitions`/`roster`/`values`/`projection`/`directory`). **Depends on**: nothing (cache-life propagation is documented; no fixture needed).

### Phase 3 — share canonical cached sources

- **PR6 `questions: share cached question rows`** (Findings 5, 6). `loadQuestionRows` is the one canonical `"use cache"` source for project-wide question rows; `loadQuestionGrid` and `loadQuestion` become plain (non-cached) derivers that call it with domain arguments only, so all three share a single cache entry per project. `loadQuestionRows` keeps the mock-based `{ db = defaultDb }` test seam (ADR 0007 rule 13). The derivers forward their own optional `db` option unchanged to `loadQuestionRows` — never resolving their own default first, so an omitted option stays `undefined` and the call still shares `loadQuestionRows`' cache entry — which keeps both derivers independently integration-testable through the same seam. No dispatch layer: a stray runtime handle, forwarded or direct, reaches the cached wrapper and Next throws loudly rather than silently bypassing the cache. Clarify ADR 0007 rules 13–14 and ADR 0008 rule 5 (seam is test-only; the forwarding pattern is the sanctioned way for a deriver to share a seam; runtime misuse throws; reject dispatch). Tighten the seam comments on `loadSubmissions`, `loadQuestionAssessment`, and `loadSubmissionAssessments`. Lock Decision 5 (whole-project-set load tradeoff) at the call site. **Acceptance**: runtime reads needing the same project-wide question rows share one cache entry; the seam is documented as test-only on every cached wrapper and deriver; ADRs clarified; the `loadQuestion` breadth choice is documented. **Depends on**: PR2.
- **PR7 `questions: cache question definitions from the canonical row source`** (Finding 4). Cache `loadQuestionDefinitions` (or document why the authoring route stays uncached); derive it from the canonical cached question rows (PR6) plus the assessment-count query. **Depends on**: PR6.
- **PR8 `assessments: share completion row cache`** (Finding 8). Add `loadAssessmentCompletionRowsCached`; derive the by-submission and summary projections from it. (`#153` already shares the primitive; this shares the cached entry.) **Acceptance**: runtime reads needing the same completion base rows share one cache entry; ADR 0007's no-runtime-handle rule stays intact. **Depends on**: PR2, PR5.

### Phase 4 — remove hidden duplicate route queries

- **PR9 `assessments: avoid duplicate submission progress reads`** (Findings 7, 10). Split question-scoped progress into a DB count primitive + a pure builder so the page reuses the submissions it already loaded, instead of `loadAssessedRubricCountsBySubmission` reloading them internally. Then re-check the question-specific grading page boundaries (Finding 10) now that shared caches (PR6, PR8) are in place: keep the section split if shared sources removed the duplication; extract a route read-model only if the page still cold-loads repeated DB work. **Acceptance**: question-specific grading no longer loads submissions twice on a cold render; any remaining repeated read is documented as an intentional cache-boundary tradeoff; no monolithic page loader without a measured benefit. **Depends on**: PR6, PR8.

### Phase 5 — improve perceived loading for grading navigation

- **PR10 `assessments: decouple progress freshness from interactive saves`** (Finding 19). Apply Decision 3. **Acceptance (behavioral)**: after saving a rubric and clicking "next submission," navigation does not block on recomputing project-wide completion. **Depends on**: PR1 (baseline), PR4, PR8.
- **PR11 `ui: prefetch submission-to-submission navigation on the overview page`** (Finding 18). Originally scoped as "extract cacheable parts of the overview body into `"use cache"` sections mirroring the question page," but PR10 removed the question page's page-level `"use cache"` wrapper too (a promise created for Suspense streaming can't be returned from inside a `"use cache"` scope), so both pages now share the same no-page-wrapper-relies-on-individually-cached-loaders shape — there is no longer a cached question page to mirror. The one concrete gap left: the question page's prev/next buttons set `prefetch`, the overview page's didn't. Add it. **Depends on**: PR10.
- **PR12 `ui: improve grading loading boundaries`** (Finding 14). Add targeted Suspense/skeletons that preserve question/submission context, only where data boundaries justify it. **Acceptance**: the grading user keeps question/submission context during navigation; loading UI matches the data boundaries chosen in earlier phases; no generic skeleton hides the whole workflow. **Depends on**: PR11.

### Phase 6 — measure, then optimize rubric overview

- **PR13 `assessments: measure rubric overview scale`** (Finding 12). Realistic fixtures; measure server query time, payload size, client render time before any architecture change. **Depends on**: nothing (can run in parallel); refactor only if measured slow. **Result**: measured at 200 submissions × 20 rubrics (see "Measured baseline (PR13, 2026-06-20)" above) — not slow; no refactor.

## Cross-plan sequencing (reliability hardening)

`plans/completed/2026-05-17-reliability-hardening.md` R-007 (progress metrics) and R-008 (rubric overview analytics) want to add correctness tests to `loadAssessmentCompletion.ts` and `rubricOverview.ts` — the exact files PR8/PR9/PR10/PR13 restructure. Sequence deliberately: land PR8–PR10 (completion sharing + freshness) and decide PR13 before R-007/R-008 pin integration tests, so the tests land on settled shapes. Note this in both plans when execution starts.

## Non-goals

- No routing or slug-canonicalization redesign for #59 (client-side cosmetic slug correction stays).
- Do not disable or work around `cacheComponents`.
- No command bus, repository layer, or deep CQRS.
- No monolithic route loaders introduced purely to remove repeated calls.
- No project-scoped tags before tag helpers are centralized.
- No rubric-overview refactor before measurement.
- No maintained end-to-end cache-runtime tests (any Phase 0 grading-loop instrumentation is throwaway).
- The navigation-drawer export-options state stays out of scope (Finding 15: not a caching hotspot); touch it only if export options grow.
