# Terminology audit follow-ups: close the gaps the sweep left behind

- **Status:** Active
- **Created:** 2026-07-15
- **Origin:** post-closure audit of #99; `plans/2026-07-06-terminology-sweep.md` (Completed), `CONTEXT.md`, `docs/reference/lexicon.md`
- **Tracked by:** #285

After #99 closed (2026-07-14), a repo-wide audit checked that the terminology sweep left nothing behind. The sweep landed thoroughly in code, UI, routes, DB schema, GitHub labels, and the main docs — but the audit found six gaps, none release-blocking, all worth closing so retired vocabulary stops leaking back through docs, tests, and old issues. This plan records the findings with enough context to execute each work stream independently, plus what was checked and deliberately *not* flagged (so future audits don't re-litigate it).

**Vocabulary refresher** (canonical: `CONTEXT.md` internal, `docs/reference/lexicon.md` user-facing): Project → **Grid**, Question → **Rubric**, leaf Rubric → **Criterion**, Team → **Group**, Submission → **Grade Target** (code-only), Assessment → **Grade**, score → **Value**, aggregate → **Total**, progress → **Completion**, Dashboard → **Overview**, criterion kinds boolean/ordinal/numerical → **Check/Options/Number**, classifier word **kind** (never "type"). The danger words are `rubric` and `question`: both still exist in the vocabulary but *changed meaning*, so pre-sweep text using them reads as the wrong concept today, not merely as dated.

## Work streams

Four independent streams — no ordering constraints between them; each is separately reviewable and shippable. Streams A and B are one PR each. Stream C is GitHub-only (no PR). Stream D is deferred to issue #288 (see Open questions).

### Stream A — docs fixes (one PR, no code)

Three documents contain stale prose the sweep's stage-9 doc audit missed. All are prose-only edits; no code, schema, or UI changes, so the validation gate is `pnpm run check --fix` (markdown lint) only.

1. **`docs/guides/nextjs-caching.md`** — two stale passages:
   - ~Line 20, the "practical consequence" paragraph: "the question-specific grading page (cached sections, explicit prefetch on prev/next) navigates fast; the submission overview page (dynamic body, `router.push` quick-jump) shows the root skeleton". Today's names: the **rubric grading page** (`app/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/rubrics/[rubricId]/page.tsx`) and the **grade-target grading page** (`…/[targetSlug]/page.tsx`). Verify the cached-vs-dynamic/prefetch claims still hold for those pages before rewording — the paragraph describes behavior, not just names.
   - ~Line 31, the "Granularity" paragraph: `SubmissionRubricSection` no longer exists. The only cached `app/` section today is `RubricHeaderSection` (rubric grading page), keyed by `{gridId, rubricId}`; `GradeTargetCriterionSection` and `GradeTargetGradingSection` are not cached. Also `submissionId` → `rubricId`, "one entry per submission … first visit to each submission" → per rubric.
2. **`docs/reference/testing-conventions.md`** — two stale spots:
   - Line 9: example path `src/assessment-completion/assessmentCompletion.test.ts` → `src/grade-completion/gradeCompletion.test.ts` (verified to exist).
   - ~Line 75, the e2e-tier description: "create project → import questions/students/assessments → dashboard completion → reload → export" → "create grid → import rubrics/students/grades → overview completion → reload → export". Cross-check the wording against what `e2e/grading-workflow.spec.ts` actually does.
3. **`docs/investigations/2026-05-20-mark-grade-weighting-model.md`** (**Status: Active** — that's why this matters; it guides the still-open aggregation/weighting work):
   - Its 2026-07-06 header note asserts as *current fact*: "`Score` names only the numerical grade's recorded payload … boolean and ordinal grades have no score". Sweep stage 7b later retired Score entirely (→ **Value**), and the kind words are retired too. Update the note to the settled state: the value pipeline is Grade → Mark → **Total** for every criterion kind; a **Number** grade's payload is its **Value** (Check and Options grades have a Yes/No answer or a label instead); Points stays avoided. Do **not** rewrite the historical body below the note — the sweep's accepted pattern is that investigation bodies stand as exploration record.
   - Also stale: the note says "Total is named but unbuilt" — Total *is* implemented (`src/results/resultsBuilder.ts` per-target `marks` sum, the Grades table's Total column, the `final_total` export column; `CONTEXT.md`'s Total entry was already corrected on this same point during stage-9 grilling).
   - Same class, lower priority, fold into the same PR: `docs/investigations/2026-05-20-domain-terminology-audit.md` (Completed) — its `Resolution` metadata line says "Score/Mark kept, Points avoided", superseded by 7b's full Score retirement. A one-line correction ("Score later retired for Value, see CONTEXT.md") keeps the Completed doc's resolution truthful without rewriting history.
   - If any of these corrections raises a genuine glossary question rather than a factual fix, use the domain-modeling skill and update `CONTEXT.md` inline — but none is expected to; the glossary entries (Value, Total) are already final.

### Stream B — test/fixture/comment/identifier sweep (one PR, behavior-preserving)

Retired criterion-kind vocabulary (`boolean`/`ordinal`/`numerical`, and "type" as the classifier) survives in test names, fixture keys, sample ids, sample labels, and production comments/error strings/identifiers. The original audit's premise — "identifiers in shipped code all moved in sweep stage 2a/2b" — turned out to be **only partially true**: a 2026-07-15 grilling/domain-modeling session held before executing this stream re-verified it with a repo-wide grep and found retired vocabulary still in *production* function, variable, and field names across grading, rubric-management, and imports, plus a third shared test fixture file the original audit missed entirely. Everything below (including the 2026-07-15 additions, each marked) is behavior-preserving renaming — no schema, route, or UI change.

**Shared fixtures first** (they fan out — rename the keys and every consumer in the same commit or nothing compiles):

- `src/test/grades.ts` — the fixture contract `criterionIds: { boolean: string; ordinal: string; numerical: string }` (declared ~lines 10, 15; defaults ~lines 40–42; sample labels "Ordinal criterion"/"Numerical criterion" ~lines 106, 114; result keys ~lines 173–174) → `{ check, options, number }` with Check/Options/Number labels. Consumers found: `src/grading/gradeMutations.integration.test.ts`, `src/grading/grades.integration.test.ts`, `src/db/constraints.integration.test.ts` (its own local `CriterionRowIds = { boolean; ordinal; numerical }` too).
- `src/test/mixedCriterionGradeFixture.ts` — comments ~lines 25 ("one criterion of each **type** (boolean/ordinal/numerical)") and 229, labels ~lines 75, 83; also the `criteria: { booleanId: string; ordinalId: string; numericalId: string }` field contract (~line 20) and its assignments (~lines 133–134) → `{ checkId, optionsId, numberId }` — the original bullet only named the comments/labels, not this contract (see grep-driven scope note below).
- `src/test/rubrics.ts` (**found in the 2026-07-15 re-audit — not in the original list**) — exports `BooleanRubricFixture`, `GradedBooleanFixture`, `createBooleanRubricFixture`, `createGradedBooleanRubricFixture`, `createOrdinalRubricFixture` (~lines 5–23, 59, 138) → Check/Options naming (`CheckRubricFixture`, `GradedCheckFixture`, `createCheckRubricFixture`, `createGradedCheckRubricFixture`, `createOptionsRubricFixture`); also the `"Boolean rubric"`/`"Ordinal rubric"`/`"Ordinal"` sample labels and the `buildTestId("criterion-boolean")`/`buildTestId("rubric-ordinal")`/`buildTestId("criterion-ordinal")` slugs. Consumers: `src/grading/grades.integration.test.ts`, `src/imports/rubrics/saveRubrics.integration.test.ts`, `src/rubrics/rubrics.integration.test.ts`, `src/rubric-management/rubricDefinitions.integration.test.ts` (**not otherwise in this stream's file list**), `src/rubric-management/rubricDefinitionMutations.integration.test.ts`.

**Per-file leftovers** (test names, sample ids, labels — a case-insensitive grep for `boolean|ordinal|numerical` scoped to each file finds them all; TS `boolean` type annotations are noise, skip those):

- `src/db/constraints.integration.test.ts` — heavy: `buildTestId("criterion-boolean")` etc., "Boolean/Ordinal/Numerical criterion" labels, test names ("ordinal criterion grades accept…", "numerical criterion grades enforce…"), grid names ("Constraint Ordinal Grid").
- `src/results/resultsBuilder.test.ts` — sample ids `r-ordinal`, `r-numerical`.
- `src/results/loadResults.integration.test.ts` — test name ~line 240 "maps the per-**type** value column for **boolean, ordinal and numerical** grades" (→ per-kind, Check/Options/Number), and ~lines 248–249 `buildTestId("rubric-ordinal")`/`buildTestId("rubric-numerical")` — note these also use the retired **leaf noun** ("rubric" for a criterion): → `criterion-options`/`criterion-number`.
- `src/rubric-management/schemas.test.ts` — describe/it names: "ordinal marks", "numerical criterion bounds", "boolean criterion whose false marks…", etc.
- `src/rubric-management/rubricDefinitionMutations.integration.test.ts` — "replaces **ordinal** criterion values…", `buildTestId("criterion-numerical")`, "Save Ordinal Values Grid", labels.
- `src/rubrics/rubrics.integration.test.ts` — "Ordinal Empty Marks Grid", "Ordinal rubric"/"Ordinal" labels.
- `src/rubrics/rubrics.test.ts` — ~line 68: test name says `maps to { kind: 'ordinal', marks: {} }` while the assertion is `kind: "options"` — the one *outright wrong* name (stale description of renamed behavior), worth calling out in the PR. Also (found via grep, not in the original bullet): the shared `booleanRow` fixture variable (~lines 10, 31, 41, 45) → `checkRow`; its `kind` is already `"check"`, only the identifier is stale. A full-file read on 2026-07-15 checked the rest of the `toCriterion` describe block (`options`/`number`/`check` sub-blocks) for the same description/assertion drift — none found beyond line 68.
- `src/export/gradeTargetExportCsv.test.ts` (**found in the 2026-07-15 re-audit**) — `failedBooleanRubrics` variable (~lines 44, 114) → `failedCheckRubrics`.
- `src/rubric-management/rubricDefinitions.integration.test.ts` (**found in the 2026-07-15 re-audit**) — no vocabulary of its own beyond consuming `src/test/rubrics.ts`'s fixture (`createGradedBooleanRubricFixture` calls, `"Boolean rubric"` label reference ~line 40); falls out automatically once that shared fixture is renamed.
- `src/export/rubricsExport.test.ts` — it-names "exports an ordinal criterion rubric", "exports a numerical criterion…" ×2.
- `src/imports/rubrics/parseRubrics.test.ts` — ~line 19 "parses reversed numerical criteria".
- `src/imports/rubrics/saveRubrics.integration.test.ts` — comment ~line 367 "(boolean/ordinal/numerical criterion)", plus the "criterion **type** change" test names (~lines 222, 259, 369).
- `src/imports/grades/saveGrades.integration.test.ts` — `buildTestId("criterion-numerical")` ~line 29, comment ~line 273.

**Production (non-test) leftovers** — the original audit found only comments/error strings here; the 2026-07-15 re-audit found this was significantly larger, including production function, variable, and field names:

- `src/imports/rubrics/saveRubrics.ts` — comment ~line 112: "Criteria whose **type** changed … so subtype tables (**boolean/numerical/ordinal** criterion) never hold stale rows for the previous **type**" → kind / Check/Options/Number. Two thrown error strings ~lines 251, 289: "Imported **numerical** criterion '…' could not be resolved." / "Imported **ordinal** criterion '…' could not be resolved." → Number/Options wording. These are internal invariant errors (resolution map inconsistency, not user input errors), but they can surface in logs/error states, and the sweep's rule was one vocabulary end to end.
- "criterion **type** change" prose in comments: `src/imports/rubrics/prepareRubricImport.ts` ~line 39, `src/imports/importErrors.ts` ~line 3. (The *identifiers* around them — `criterionKindChanges`, `RubricImportCriterionKindChange` — were renamed in stage 2b; the surrounding prose wasn't.)
- `src/export/gradeTargetExport.integration.test.ts` ~line 60: "mixed criterion **types**" → kinds.
- `src/rubric-management/rubricDefinitionMutations.integration.test.ts` ~line 129: "when criterion **type** changes" → kind.
- `src/grade-persistence/gradeMutations.ts` (**found in the 2026-07-15 re-audit**) — `saveOrdinalGrade`/`ordinalGrade`/`ordinalLabels` (~lines 203–231) → `saveOptionsGrade`/`optionsGrade`/`optionsLabels`; `saveNumericalGrade`/`numericalGrade` (~lines 240–303) → `saveNumberGrade`/`numberGrade`.
- `src/rubric-management/OptionsEditorPaper.tsx` (**found in the 2026-07-15 re-audit**) — `ordinalMarksToText`/`parseOrdinalMarks` (~lines 18, 24) → `optionsMarksToText`/`parseOptionsMarks`.
- `src/rubric-management/rubricDefinitionMutations.ts`, production side (**found in the 2026-07-15 re-audit** — only its integration test was in the original list) — `numericalRows`, `ordinalSources`, `existingOrdinalValues`, `ordinalValueRows` (~lines 283–434) → `numberRows`, `optionsSources`, `existingOptionsValues`, `optionsValueRows`.
- `src/rubrics/rubrics.ts`, production side (**found in the 2026-07-15 re-audit**) — `ordinalMarks`, `ordinalMarksByCriterionId` (~lines 127, 219–260) → `optionsMarks`, `optionsMarksByCriterionId`.
- `src/imports/grades/gradeImportContext.ts` and `src/imports/grades/prepareGradeImport.ts` (**found in the 2026-07-15 re-audit**) — `ordinalLabels` field (`gradeImportContext.ts` ~lines 49–55; `prepareGradeImport.ts` ~lines 16, 107–108) → `optionsLabels`; fans into `src/imports/grades/prepareGradeImport.integration.test.ts` and `prepareGradeImport.test.ts` (**neither in the original file list**), both with heavy `ordinalLabels`/`criterionIds.ordinalId`/`.numericalId` usage.

**Confirmed out of scope** (2026-07-15 re-audit — a different sense of "ordinal": positional index, not the criterion kind): `src/export/gradeTargetExportGrouping.ts` ~line 34, `src/grade-completion/loadGradeCompletion.integration.test.ts` ~lines 181/229, `src/grade-targets/gradeTargets.ts` ~line 104 and its `.integration.test.ts` ~lines 153/199 — all describe per-grid id ordinals (1st/2nd/3rd), unrelated to the retired Options criterion kind; leave these untouched. Also `z.boolean()` (`src/imports/schemas.ts` ~line 61, `src/rubric-management/schemas.ts` ~line 41) and `GradeTargetExportValue`'s `boolean` union member (`src/export/gradeTargetExportCsv.ts` ~line 57) — genuine data-type uses, not the retired kind.

**Cosmetic rider — decided 2026-07-15: include in this PR** (same precedent as the sweep's `Team A` → `Group A` and `"Score"` → `"Value"` fixture renames): sample names on the progress→Completion axis in `src/grade-completion/loadGradeCompletion.integration.test.ts` — grid names "Progress Isolation A/B", "Overview Progress Isolation A/B", "Rubric Progress Wrapper/Split", "Overview Progress Wrapper" and the fixture `lastName: "Progress"` → Completion-worded equivalents. (This file also has unrelated `ordinal` hits describing per-grid id ordinals — see "Confirmed out of scope" above; don't touch those.)

**Sweep-craft rules carried over from the terminology sweep** (hard-won there, apply here):

- The per-file bullets above are illustrative, not exhaustive — grep each file case-insensitively for `boolean|ordinal|numerical` yourself and fix every genuine hit (skip only TS `boolean` type annotations and the "positional ordinal" sense noted above). Decided 2026-07-15: the original list is grep-driven in principle but wasn't exhaustively re-verified — the re-audit found real misses in files that already had a bullet (e.g. `rubrics.test.ts`'s `booleanRow`) as well as whole files and identifiers missing from the list entirely.
- Case-sensitive find-and-replace misses ALL-CAPS constants; grep the upper-cased term afterward (no ALL-CAPS hits are known in this scope, but verify).
- A mechanical noun rename breaks a/an article agreement ("an ordinal" → "a options" is wrong twice); grep `\ban? (options|check|number)\b` after sweeping.
- Don't leak this plan's own labels ("stream B", finding numbers) into code comments — comments must be self-contained.
- Keep the axis discipline: this stream renames *retired criterion-kind vocabulary only* (prose, fixtures, and the identifiers carrying it); don't opportunistically rename unrelated symbols while in the files.

**Validation:** `pnpm run check --fix`, `pnpm run check-types`, then the vitest projects covering the touched files — full `vitest` is simplest since most of the diff *is* tests (unit + integration; integration needs the testcontainer Postgres). Decided 2026-07-15: run the full suite including integration/testcontainer tests — cheapest way to confirm the expanded identifier renames (not just prose) didn't miss a consumer, given the diff is now bigger than the original scope. No production `build` or `test:e2e` needed: no route, schema, or UI-label change (`e2e/` was verified clean in the audit). Run the simplify pass on touched files per AGENTS.md.

### Stream C — GitHub issue triage (no PR)

~20 open issues predate the sweep and use retired vocabulary. Because `rubric` and `question` changed meaning, several are now **actively inverted** — an agent or contributor reading them today would build the wrong thing (AGENTS.md routes agents to issues as work input, which is what makes this the highest-risk finding). Follow `docs/guides/issue-and-pr-conventions.md`; per AGENTS.md, do not touch milestones, priorities, or project boards.

**Suggested treatment per issue:** retitle to current vocabulary + add one clarifying comment ("Terminology updated after #99: this issue's original text used X for what is now Y; body references may cite renamed files"), rather than silently rewriting bodies — bodies are historical discussion context, and dead file paths in them are discoverable via the comment. *Open decision for the user before executing: retitle+comment (recommended) vs. full body rewrite.* Re-check each issue's premise against current code while touching it — some may be obsolete, not just misworded.

Inventory (state at audit time, 2026-07-15):

| Issue | Problem | Notes |
| --- | --- | --- |
| #50 "Add destructive confirmation when deleting rubrics" | **Inverted**: "rubrics" = today's **criteria**; body cites dead `src/questions/RubricEditorList.tsx` and says "question deletion" has the confirmation dialog (that is today's *rubric* deletion, `DeleteRubricDialog`) | Verify whether criterion removal in the rubric editor still lacks confirmation before retitling |
| #66 "Allow reordering rubrics within questions" | **Inverted**: means criteria within rubrics | |
| #6 "…question/rubric visibility filtering" | **Inverted**: means rubric/criterion | |
| #37 "…YAML editor for importing questions and editing rubrics" | **Partially inverted** | |
| #111 "Question YAML import preview…" | Stale: Question → Rubric | Part of the #108 preview family |
| #44 "Add rating rubric type" | Two rejected words: "rating" is on the Criterion entry's _Avoid_ list (scale/rating/levels imply an order the model doesn't have), classifier is "kind" | Retitle needs care: the *feature* may still be wanted; name it per what it actually proposes (likely an Options-kind preset or a new kind) |
| #90 "Ignore unassessed submissions in rubric overview class average" | Four retired terms **and a deleted premise**: the "Class average" summary strip was removed in sweep stage 1 (PR #245) | **Re-triage, not reword**: check whether any surviving surface (Criterion Analytics per-criterion averages) still has the reported problem; close as obsolete otherwise. *User decision.* |
| #89 "Make submission matrix entries navigate to assessments" | Stale: Grades table / grading pages | |
| #79 "Add total average rows to submission matrix and rubric analysis" | Stale: Grades table / Criterion Analytics | |
| #173 "assessments: round displayed total grade" | Stale + vocabulary violation: the aggregate is **Total**, never "grade" | |
| #109 "Assessment CSV import preview…" | Stale: Grades CSV | Part of the #108 family |
| #86 "Centralize user-facing assessment messages for i18n…" | Stale: grade messages | |
| #84 "Assessment save errors are not visible on iPad" | Stale: grade save errors | |
| #92 "…manual apply-defaults action for rubric assessment" | Stale: grading | |
| #61 "Dynamic assessment target creation during grading" | Stale: Grade Target (code-only word — title should name Student/Group creation) | Linked from CONTEXT.md's Grade Target entry; keep the link intact |
| #43 "…viewing student work alongside assessment" | Stale: grading | |
| #133 "batch assessment saves during import" | Stale: grade saves | |
| #38 "Remove implicit default project behavior" | Stale: grid | Verify premise still exists |
| #12 "Add portable project import/export…" | Stale: grid | |
| #108 "Preview and configure imports before applying changes" | Body likely stale (umbrella for #109/#110/#111) | Title itself is clean |

Issues checked and *clean or already tracked*: #278 (ADR 0010 staleness — filed by the sweep itself), #132, #283, #273, #267, #243, #45, #47, #110 and the rest of the open list use current vocabulary in their titles (bodies not exhaustively audited — spot-check while triaging anything you touch).

*Investigation note:* the audit read titles for all open issues but bodies only for #50 and #66. Whoever executes this stream should skim each body while retitling — the table's "Problem" column is title-based and a body may be better or worse than its title suggests.

**Tracking:** decide with the user whether this plan gets an umbrella tracking issue (sweep precedent: one umbrella, per-PR `Related to`/`Closes`) — if yes, streams A/B/D reference it from their PRs and stream C's clarifying comments can link it.

### Stream D — `GradeTargetSubmitter` (decision, then a small PR or a deferral)

`src/grade-targets/types.ts` exports `GradeTargetSubmitter` (~line 41), consumed by `src/export/gradeTargetExport.ts`, `gradeTargetExportCsv.ts`, and their tests. "Submitter" is the retired submission-family word — sweep stage 4 renamed the grades-CSV `submitter` column to `name` but this type kept the word. An existing `FIXME` in the same file (~line 18) already flags the type design as awkward independently of naming: the `GradeTargetDisplay` part is UI-facing and arguably misplaced, `GradeTarget` vs `GradeTargetSubmitter` is unclear, and the types should derive from the generated Kysely types (`Selectable`) per the Schema Alignment Rule.

**Decision for the user:** (a) quick rename now (something like `GradeTargetIdentity` — it carries the student id / group name used for export matching; pick the name against `CONTEXT.md`, and note bare "target" is on the _Avoid_ list) leaving the FIXME's structural cleanup for later, or (b) resolve the FIXME properly in one go (restructure + derive from generated types + the rename falls out), or (c) file an issue and defer. Option (a) folded into stream B is the cheapest way to finish the vocabulary; option (b) is a genuinely separate design task — if chosen, it likely warrants its own short grilling session first.

**Decided 2026-07-15: option (c)** — deferred to issue [#288](https://github.com/QuentinRoy/tardigrade/issues/288). Not part of Stream B's execution; `GradeTargetSubmitter` is left untouched for now.

## Checked and deliberately NOT flagged

Recorded so future audits don't re-litigate these. None of the following is a gap:

- **Committed migrations** (`src/db/migrations/`) legitimately contain every retired name — the "never rewrite committed migrations" rule (`docs/reference/database-migrations.md`) excludes them from any sweep.
- **TS `boolean` type annotations** everywhere, and README's "`reversed` (optional boolean)" — data-type descriptors, not the retired criterion kind.
- `src/grading/quickJumpSearch.ts` `combinedScore` / Fuse.js `score` — fuzzy-search relevance, explicitly carved out in sweep stage 7b. Likewise `CodeSnippet.stories.tsx`'s illustrative `calculateGrade(score)`.
- Mantine `<Progress>`, the `CompletionProgress` bar widget, `isDragInProgress`, and the bar-local `progressLabel`/`progressValue` props — the honest progress-*bar* carve-out from stage 5c. (`InProgress` story names in `CompletionSummary.stories.tsx`/`GlobalCompletionSummary.stories.tsx` are ordinary English for a partially-complete state.)
- `src/db/migrate.ts` `question` (readline prompt), `e2e/ephemeralPostgres.ts` "Compose project" (Docker Compose), "form submission" in `UncontrolledNumberInput.stories.tsx`, "points to" in `parseRubrics.test.ts` — unrelated English/technical senses.
- `src/grade-persistence/gradeMutations.ts` ~line 34 comment "unlike the old globally-unique numeric submission id" — a self-contained historical contrast explaining why `gridId` is a required parameter; exactly the kind of comment the conventions want.
- `.agents/skills/lexicon/SKILL.md`'s "assessment" string — it is the *Bad* example, on purpose. The GitHub `question` label — standard GitHub taxonomy, not domain vocabulary. `docs/index.md`'s investigation titles ("Assessment target model", "the `assessment` container table") — historical document names, the accepted pattern.
- `docs/investigations/2026-05-20-assessment-target-model.md` — Active, but its 2026-07-06 note already uses Grade Target/Group correctly; the body is historical exploration record.
- Third-party/generic skills (`mantine-*`, `next-best-practices`, `storybook-*`, `caveman`, `kysely`) — their `boolean`/`score`/`progress` hits are unrelated to this domain. Known separately: `.agents/skills/kysely/SKILL.md` still documents kysely-codegen while the repo moved to kanel (stage 5a declared it out of scope — it's a generic Kysely guide, not repo toolchain doc); track only if the user wants it.
- `.claude/skills` is a **symlink** to `.agents/skills` — don't audit or edit it twice.

## Verified done by the audit (no work needed)

GitHub labels renamed (`grading` created, `rubrics` redescribed; no `assessment` label remains); #99 closed as completed (2026-07-14) and #136 closed via sweep stage 6; the sweep plan is `Status: Completed` and removed from `plans/index.md`; `docs/reference/url-conventions.md` exists; README fully refreshed (PR #281); `e2e/` specs and fixtures clean; UI strings clean (no "assessed"/"matrix"/"Grade Target"/"class average"/"score"/"dashboard" user-facing); `docs/reference/cache-invalidation-map.md` current; the repo's house-rule skills (`typescript-api-design`, `ui-styling`, `error-handling-ux`, `testing`, `react-patterns`, `simplify`, `domain-modeling`, `lexicon`) clean.

## Open questions (resolve with the user before or during execution)

1. **Stream C treatment:** retitle + clarifying comment (recommended) vs. full body rewrites.
2. **Tracking:** one umbrella issue for this plan (sweep precedent) vs. per-stream issues vs. none.
3. **#90:** close as obsolete (its target surface was deleted in stage 1) or re-scope to Criterion Analytics.
4. **Stream D:** quick rename, full FIXME resolution, or defer via issue. **Resolved 2026-07-15: deferred via issue [#288](https://github.com/QuentinRoy/tardigrade/issues/288).**

## Out of scope

- ADR 0010's stale folder mapping — already tracked as #278.
- Branded id types — #132 (deliberately sequenced after the sweep).
- The structural questions kept open by the Active investigations (Student/Group unification, aggregation/weighting model) — not terminology work.
- Any behavior change. Every stream here is prose, naming, or GitHub metadata.
