# Investigation: overlap between ongoing investigations and planning artifacts

Status: Completed
Date: 2026-05-25
Last reviewed: 2026-06-22
Related: #115, #117, PR #116
Resolution: This document existed to keep the source-structure audit, reliability plan, and read-write-separation investigation from silently contradicting each other while #115/#117 sequencing was in flight. All four issues it was coordinating around are now closed (#115, #117, #59, #51), and the source-structure audit's prioritized backlog is empty (see `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md`). The ownership map and risk analysis below are kept for historical context but are no longer actively maintained; some specifics are stale (for example, the caching/loading investigation it called for now exists at `docs/investigations/2026-06-11-caching-loading-audit.md`, and the read-write-separation investigation is now "largely implemented"). The product/domain investigations it also mapped (terminology, assessment target model, mark/grade/weighting, grading workflows and product positioning, offline support, repo documentation architecture) remain open on their own; consult them directly rather than through this document.
Follow-up: None.

## Question

How do the source-structure audit, other ongoing investigations, open roadmap issues, and planning artifacts overlap, and which artifact should own which part of the reasoning?

This document exists to prevent investigations, issues, and plans from becoming contradictory or duplicative as more audits are added.

## Executive summary

The source-structure audit overlaps most strongly with:

1. domain terminology and assessment target investigations;
2. grading workflow and product positioning;
3. loading, caching, and offline-support investigations;
4. repository documentation and agent-instruction investigations;
5. the reliability hardening plan;
6. the read-write separation investigation.

The overlap is mostly healthy if ownership is clear:

- terminology investigations should own vocabulary and conceptual model questions;
- product-positioning investigations should own workflow/product-scope questions;
- offline/caching investigations should own persistence, sync, and freshness behavior questions;
- the source-structure audit should own concrete code seams, module splits, and refactor candidates;
- the reliability plan should own reliability risks, priority, status, and test evidence;
- the read-write separation investigation should own the proposed direction for separating write paths from read projections;
- active plans should own executable sequencing only when work is ready to be carried out;
- documentation investigations should own how these artifacts are organized and linked.

The main risk is that source-structure, reliability, and read-write-separation artifacts all touch the same code hotspots. They should be read together, but they should not silently override one another.

## Existing artifact set reviewed

Current investigation documents considered:

- `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md`
- `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md`
- `docs/investigations/2026-05-20-domain-terminology-audit.md`
- `docs/investigations/2026-05-20-assessment-target-model.md`
- `docs/investigations/2026-05-20-mark-grade-weighting-model.md`
- `docs/investigations/2026-05-22-grading-workflows-and-product-positioning.md`
- `docs/investigations/2026-05-19-offline-support.md`
- `docs/investigations/2026-05-19-repo-documentation-architecture.md`
- `docs/investigations/2026-05-26-agent-instruction-architecture-audit.md`
- `docs/investigations/2026-05-20-commit-message-conventions.md`

Current active plans considered:

- `plans/active/2026-05-17-reliability-hardening.md`

## Overlap map

| Topic | Source-structure audit touches | Existing owner | Recommended ownership |
| --- | --- | --- | --- |
| Project/assignment terminology | Project route context, project folder names, project paths | `2026-05-20-domain-terminology-audit.md`, `2026-05-22-grading-workflows-and-product-positioning.md` | Terminology/product docs own naming; source audit owns implementation consequences |
| Assessment vs grading | Candidate `src/grading` folder, action/service naming | `2026-05-20-domain-terminology-audit.md` | Terminology doc owns vocabulary; source audit can use provisional names |
| Student/team/group/submission model | Submission read models, progress, imports | `2026-05-20-assessment-target-model.md` | Assessment target doc owns conceptual model; source audit owns current code friction |
| Mark/grade/score/weighting | Progress, rubric overview, numeric rubric editing | `2026-05-20-mark-grade-weighting-model.md` | Mark/grade doc owns semantics; source audit owns duplicated calculations and code seams |
| Spreadsheet replacement/import/export philosophy | Import preview, export streaming, explicit operations | `2026-05-22-grading-workflows-and-product-positioning.md` | Product doc owns workflow philosophy; source audit owns implementation quality |
| Offline/local-first storage | Commands, transaction-friendly APIs, local project snapshots | `2026-05-19-offline-support.md` | Offline doc owns offline architecture; source audit/read-write investigation should keep command seams compatible |
| Loading/caching/revalidation | Project loaders, cache tags, grading page read models | #59 and future caching investigation/design | Caching investigation owns freshness strategy; source audit/read-write investigation own refactor seams that enable it |
| Reliability risks and test evidence | Export/progress/import/assessment save seams | `plans/active/2026-05-17-reliability-hardening.md` | Reliability plan owns risk priority/status/evidence; source audit owns structural causes and refactor candidates |
| Read/write separation | Command/write paths and read projections | `2026-05-26-read-write-separation-and-schema-change-resilience.md` | Read-write investigation owns proposed direction; smaller active plans should own concrete execution later |
| Documentation lifecycle | Investigation vs ADR vs design vs plan | `2026-05-19-repo-documentation-architecture.md` | Documentation architecture owns lifecycle; individual docs should state their status clearly |
| Agent guidance | How agents find/use audits and plans | `2026-05-26-agent-instruction-architecture-audit.md` | Agent docs own instruction strategy; investigations/plans should not become implicit agent instructions |
| Commit style | PR/commit naming | `2026-05-20-commit-message-conventions.md` | No meaningful overlap |

## Planning artifact overlap analysis

### 1. Reliability hardening plan

#### Existing plan scope

`plans/active/2026-05-17-reliability-hardening.md` is a living reliability tracker and delivery dashboard. It tracks risks by tier, score, status, issue number, evidence, and next action.

It owns:

- data-loss and data-corruption risks;
- wrong grades/totals/progress/export risks;
- UX/operational reliability risks;
- test evidence for mitigations;
- reliability priority and sequencing.

#### Overlap with source-structure audit

The reliability plan names several hotspots that also appear in the source audit:

- `src/db/questions.ts`
- `src/db/assessments.ts`
- `src/import/saveAssessments.ts`
- `src/import/saveQuestions.ts`
- `src/export/submissionExport.ts`
- `src/db/submissionProgress.ts`
- `src/db/assessmentsProgress.ts`
- `src/db/rubricOverviewBuilder.ts`

The source audit explains why these files are hard to maintain. The reliability plan explains which risks matter most and what evidence is needed to consider them mitigated or verified.

#### Risk

Reliability and DX work may accidentally compete. A source cleanup might seem attractive for maintainability while leaving Tier 0/Tier 1 risks under-tested.

#### Recommended boundary

- Reliability plan owns risk priority, issue status, and test evidence.
- Source audit owns structural causes and refactor candidates.
- #117 should sequence DX refactors while keeping Tier 0/Tier 1 reliability risks visible.

When implementation touches a reliability-risk area, PRs should link both the relevant issue and the reliability plan row where appropriate.

### 2. Read-write separation and schema-change resilience investigation

#### Existing investigation scope

`docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md` proposes separating write-side command/persistence paths from read-side projection/reporting paths.

It owns the proposed direction for:

- write-side command/repository boundaries;
- read projection modules for export/progress/overview/rubric analytics;
- hiding storage key details behind stable boundaries;
- reducing schema-change blast radius.

#### Overlap with source-structure audit

The source audit rediscovered many of the same code hotspots, but with a broader DX lens. The read-write separation investigation is narrower and focused on one architectural direction.

Strongly overlapping hotspots:

- `src/db/questions.ts`
- `src/db/assessments.ts`
- `src/import/saveQuestions.ts`
- `src/import/saveAssessments.ts`
- `src/export/submissionExport.ts`
- `src/db/submissionProgress.ts`
- `src/db/assessmentsProgress.ts`
- `src/db/rubricOverview.ts`

#### Risk

The read-write separation investigation can look like the accepted architecture, but it remains exploratory/proposed. It also references terminology and folder-boundary decisions that may be affected by the terminology, product, and source-structure investigations.

#### Recommended boundary

- Read-write separation investigation owns the proposed direction and rationale.
- #115/source audit owns the broader source-structure investigation.
- #117 owns the sequencing decision across docs cleanup, route context, read-write separation, and reliability work.
- #51 owns database identifier naming that may affect read/write boundaries.
- Concrete execution should be captured later in smaller active plans, not by treating this investigation as the implementation plan.

## Detailed investigation overlap analysis

### 1. Domain terminology audit

#### Existing investigation scope

`2026-05-20-domain-terminology-audit.md` is explicitly the broad terminology audit. It distinguishes artifact roles: issues frame problems, investigations hold evolving reasoning, ADRs record decisions, and code/tests represent implemented behavior. It also warns that presence in an investigation does not imply adoption.

It currently owns broad vocabulary questions around:

- `Project` versus `Assignment`, `Exam`, `Activity`, or `Assessment`;
- `Assessment` versus `Grading`, `Marking`, and `Evaluation`;
- `Question` versus `Exercise`, `Item`, `Rubric`, or `Criterion`;
- `Student`, `Team`, `Group`, `Submission`, and `Assessment target`.

#### Overlap with source-structure audit

The source-structure audit proposes names such as:

```txt
src/grading/
src/questions/
src/rubrics/
src/submissions/
src/projects/
```

It also suggests moving from `src/assessment` toward `src/grading`, and it questions project route context and `projectPaths` naming.

That creates vocabulary overlap.

#### Risk

The source-structure audit could accidentally freeze provisional names before the terminology investigation converges.

Examples:

- choosing `src/grading` might bias against keeping `assessment` as the code term;
- keeping `src/questions` might reinforce `Question` even if future terminology moves toward `Exercise`, `Task`, or `Section`;
- keeping `rubric` as a top-level shared folder might reinforce current usage even if current rubric entries later become `Criterion`.

#### Recommended boundary

`2026-05-20-domain-terminology-audit.md` should own naming decisions.

`2026-05-25-source-structure-and-tech-debt-audit.md` should treat names as provisional and implementation-oriented.

Recommended wording to preserve in the source audit:

```txt
Folder names are provisional and should be revisited after terminology decisions converge.
```

#### Suggested link direction

The source audit should link to the terminology audit when discussing:

- `assessment` -> `grading` naming;
- `question` / `rubric` / `criterion` split;
- `project` / `assignment` top-level naming.

### 2. Assessment target model investigation

#### Existing investigation scope

`2026-05-20-assessment-target-model.md` focuses on assessment targets, group terminology, and individual versus grouped assessment. It currently leans toward `Group` over `Team`, with singleton groups representing individual assessment targets.

It distinguishes workflow/presentation concerns from persistence invariants.

#### Overlap with source-structure audit

The source audit discusses:

- submissions and submission navigation;
- progress per submission;
- submission overview assessment pages;
- imports that resolve students/teams/submissions;
- app shell and route paths using `submissions`.

These areas depend on the target model.

#### Risk

Refactoring around current `Submission` and `Team` concepts too aggressively could make a future `Group`-based target model harder to implement.

For example, introducing many new modules named only around `submission` may be reasonable today, but if the target model later distinguishes:

```txt
Student -> Group -> Submission -> Assessment target
```

then the module naming might need another pass.

#### Recommended boundary

`2026-05-20-assessment-target-model.md` should own the conceptual model:

- what an assessment target is;
- whether singleton groups replace individual/team branching;
- how groups, students, and submissions relate.

The source audit should own current implementation pain:

- duplicated submission navigation code;
- progress calculations keyed by submission;
- import resolution of submitters;
- page read models currently centered around submissions.

#### Refactor implication

Avoid overfitting new APIs to `team` versus `individual` unless necessary. Prefer naming that can survive the target-model decision:

```txt
AssessmentTarget
SubmissionTarget
Submitter
Group
```

where appropriate.

### 3. Mark, grade, and weighting investigation

#### Existing investigation scope

`2026-05-20-mark-grade-weighting-model.md` owns the distinction between:

- rubric-level mark;
- optional raw score;
- question grade;
- final grade;
- weighting and scaling.

It proposes that all rubric types produce a `Mark`, while `Score` is optional for some numerical rubrics.

#### Overlap with source-structure audit

The source audit identifies:

- duplicated progress and analytics logic;
- rubric overview read models;
- numeric rubric editing problems;
- export/import behavior around assessment columns and marks columns;
- possible `rubricMarking` and `rubricAssessment` modules.

#### Risk

A source refactor could stabilize current code vocabulary such as `score`, `marks`, `grade`, or `rubricAssessment` before the mark/grade model converges.

It could also extract the wrong shared abstraction if progress/analytics code is unified before the semantics are settled.

#### Recommended boundary

`2026-05-20-mark-grade-weighting-model.md` should own semantics:

- what counts as a mark;
- what counts as a grade;
- whether raw numerical inputs are scores;
- how weighting should work.

The source audit should own code-quality observations:

- duplicated calculations;
- inconsistent naming in modules;
- missing pure builders;
- places where current code makes future weighting harder.

#### Refactor implication

When extracting progress or rubric calculation helpers, prefer names that align with the investigation direction:

```txt
markRubric
getRubricMaxMarks
summarizeMarks
buildGradeSummary
```

Avoid making `score` the generic term for all rubric outputs unless the terminology investigation changes direction.

### 4. Grading workflows and product positioning investigation

#### Existing investigation scope

`2026-05-22-grading-workflows-and-product-positioning.md` asks what problem the project solves, who it is for, and where scope boundaries sit. It frames spreadsheets as a likely practical competitor and LMSes as likely integration targets.

It proposes principles such as:

- optimize for grading workflows;
- prefer explicit operations over hidden behavior;
- preserve portability of grading data;
- integrate before replacing.

#### Overlap with source-structure audit

The source audit discusses:

- import preview and confirmation;
- export streaming and CSV behavior;
- parse-preview-confirm workflow;
- explicit import/export operations;
- silent skipping of missing submissions;
- the source code being optimized around grading rather than course management.

#### Risk

The source audit may accidentally turn product hypotheses into implementation mandates.

For example, moving imports to parse-preview-confirm is both a technical and product decision. It aligns with explicit operations, but the details belong partly to product/workflow design.

#### Recommended boundary

`2026-05-22-grading-workflows-and-product-positioning.md` should own product-level principles:

- whether spreadsheet replacement is the right framing;
- whether import/export transparency is a core value;
- which workflows matter most.

The source audit should own technical consequences:

- current import code can support preview because it already has a preparation phase;
- current export code needs clearer state-machine seams;
- current UI makes import operations too opaque.

#### Refactor implication

Implementation issues for import/export should link both documents:

- source audit for code seams;
- product positioning for workflow principles.

### 5. Offline support investigation

#### Existing investigation scope

`2026-05-19-offline-support.md` explores optional offline grading mode. It recommends keeping PostgreSQL as canonical and adding IndexedDB/Dexie as a browser-side local store with an explicit assessment command outbox.

It also proposes shared TypeScript domain types, shared command constructors, server command handlers, sync endpoints, local project snapshots, and conflict policies.

#### Overlap with source-structure audit

The source audit proposes:

- splitting assessment save logic into commands/repositories/actions;
- making assessment command APIs transaction-friendly;
- creating clearer read models for grading pages;
- centralizing project route context;
- keeping domain types outside DB modules.

These overlap strongly with the offline architecture.

#### Risk

A source refactor could choose command boundaries that work for current online saves but do not support a future durable outbox.

For example, an API too tightly coupled to `FormData`, server actions, or Kysely transactions would be harder to reuse for offline sync.

#### Recommended boundary

`2026-05-19-offline-support.md` should own offline architecture:

- IndexedDB/Dexie storage;
- outbox format;
- sync endpoint;
- conflict strategy;
- local project snapshots.

The source audit should own immediate refactor needs:

- isolate assessment command validation;
- avoid DB modules owning domain commands;
- keep commands serializable enough for future sync;
- separate command semantics from server action wrappers.

#### Refactor implication

When splitting `src/db/assessments.ts`, prefer a command shape that could later be stored in an outbox:

```ts
SetAssessmentValueCommand
```

rather than a shape that only works as a server-action implementation detail.

### 6. Loading, caching, and revalidation investigation / issue

#### Current status

There is an open issue (#59) to audit and redesign loading, caching, and revalidation behavior. It is not represented by a dedicated investigation document in the current list, but the source audit touches the same area heavily.

#### Overlap with source-structure audit

The source audit discusses:

- project-scoped route loaders;
- page-level repeated project loading;
- submission overview read models;
- question-specific grading loader boundaries;
- cache tags and invalidation;
- stable question/rubric data versus submission-specific assessment data.

#### Risk

The source audit could become the de facto caching investigation, but it does not fully cover the UX/loading-boundary questions that #59 raises.

In particular, #59 needs to own:

- what should remain visible during navigation;
- which route segments should have loading boundaries;
- which data should be cached at which scope;
- whether previous/next submissions should be prefetched;
- when `router.refresh()` is appropriate.

#### Recommended boundary

Create a dedicated caching/loading investigation or design doc for #59.

The source audit should keep only enabling refactors:

- add page read models;
- centralize project route context;
- document cache invalidation seams;
- split stable versus submission-specific loaders.

### 7. Repository documentation architecture investigation

#### Existing investigation scope

`2026-05-19-repo-documentation-architecture.md` defines document categories and lifecycle:

- README for onboarding;
- AGENTS for short operational instructions;
- ADRs for decisions;
- investigations for open-ended exploration;
- design docs for chosen implementation approaches;
- reference docs for durable current-system facts;
- plans for temporary execution artifacts.

#### Overlap with source-structure audit

The source audit is a long investigation. It has recommendations, target shapes, and follow-up issue candidates. It could easily be mistaken for a design doc or ADR.

#### Risk

The source audit may become too decision-like without an explicit status boundary.

#### Recommended boundary

Keep the source audit as an investigation. When a concrete direction is chosen, extract:

- ADRs for durable decisions, e.g. project slug storage or id conventions;
- design docs for large implementation work, e.g. assessment command split;
- smaller issues for executable refactor tasks.

#### Documentation index implication

`docs/index.md` lists current investigations, but planning artifacts may still need clearer cross-linking when they overlap with investigations.

### 8. Agent instruction architecture audit

#### Existing investigation scope

`2026-05-26-agent-instruction-architecture-audit.md` owns how repository instructions should be organized so agents can follow conventions without duplicated or conflicting guidance. It recommends:

```txt
AGENTS.md -> short operational rules and navigation
README.md -> onboarding and contributor workflow overview
.github/copilot-instructions.md -> tool glue only
docs/* -> durable knowledge
```

#### Overlap with source-structure audit and plans

The source audit and planning artifacts discuss code organization and agent-safe refactors. They are likely to be read by agents doing future refactors.

#### Risk

Investigations and plans could become implicit instruction files if agents treat their target structures as mandatory.

#### Recommended boundary

Agent instructions should tell agents when to consult investigations/plans. The investigations/plans themselves should not become operational agent rules.

Possible future AGENTS guidance:

```txt
For source-structure refactors, consult docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md, issue #115, and any active plan linked from #117. Treat investigations/plans as non-final unless an ADR/design supersedes them.
```

### 9. Commit message conventions investigation

#### Existing investigation scope

Commit-message conventions concern commit and PR message style.

#### Overlap with source-structure audit and plans

No meaningful conceptual overlap.

Potential interaction only:

- future refactor PRs may need clear commit messages;
- if source-structure work is split into many PRs, commit conventions can help reviewability.

No source-audit change needed.

## Main duplication risks

### Risk 1: terminology drift

The source audit and read-write separation investigation propose concrete names. Existing terminology docs have not converged. This can cause premature naming lock-in.

Mitigation:

- mark target names as provisional;
- link terminology docs;
- avoid ADR-level language in investigations and proposed plans.

### Risk 2: caching work hidden inside structure work

The source audit and read-write separation investigation propose loader/read-model refactors that would affect caching. #59 needs a deeper freshness/loading strategy.

Mitigation:

- create or link a dedicated caching/loading investigation;
- keep source audit and read-write investigation focused on code seams;
- do not decide route loading behavior only from source-structure concerns.

### Risk 3: offline-compatible command boundaries missed

The source audit and read-write separation investigation propose splitting commands from DB modules. Offline support has stronger requirements for serializable commands and outbox replay.

Mitigation:

- make assessment command shapes compatible with future outbox storage;
- avoid server-action-only command shapes;
- link offline investigation when refactoring assessment save paths.

### Risk 4: product workflow decisions disguised as technical cleanup

Import preview, export clarity, and explicit operations are product/workflow decisions, not just code organization.

Mitigation:

- link product-positioning investigation;
- split implementation work only after workflow behavior is accepted;
- phrase parse-preview-confirm as a candidate direction until accepted.

### Risk 5: planning artifacts become stale or over-canonical

The read-write separation document was proposed before the newer source-structure and overlap audits. It contains valuable implementation direction, but it should not silently become final architecture.

Mitigation:

- keep #117 as the roadmap issue that reconciles planning artifacts before execution;
- use `docs/investigations/` for proposed directions that are not being executed;
- create smaller `plans/active/...` files only when implementation starts;
- promote accepted design decisions into `docs/design/` or ADRs when appropriate.

## Recommended future document ownership

### Source-structure and technical-debt audit owns

- module split candidates;
- overgrown files;
- refactor sequencing;
- code seams;
- duplicated implementation patterns;
- candidate source tree shapes;
- follow-up implementation issues.

### Read-write separation investigation owns

- proposed direction for separating write paths from read projections;
- candidate phase order for write-side and read-side extraction;
- schema-change-resilience goals;
- implementation guardrails for that refactor track.

### Reliability hardening plan owns

- reliability risk register;
- severity and status;
- test evidence;
- reliability sequencing and risk re-scoring.

### Domain terminology audit owns

- `Project` versus `Assignment`;
- `Assessment` versus `Grading`;
- `Question` versus `Exercise`;
- `Rubric` versus `Criterion`;
- `Mark`, `Grade`, `Score`, `Weight` vocabulary.

### Assessment target model owns

- `Student`, `Team`, `Group`, `Submission`, and `AssessmentTarget` semantics;
- singleton group idea;
- persistence versus UI distinctions for individual/grouped grading.

### Mark/grade/weighting investigation owns

- rubric output semantics;
- raw score versus mark;
- aggregation and weighting concepts;
- normalization policy.

### Product-positioning investigation owns

- spreadsheet replacement hypothesis;
- LMS integration boundaries;
- import/export workflow philosophy;
- explicit operations as a product value.

### Offline-support investigation owns

- local IndexedDB/Dexie storage;
- assessment command outbox;
- sync endpoint shape;
- conflict strategy;
- local project snapshots.

### Caching/loading investigation should own

- route segment loading strategy;
- cache tag strategy;
- data freshness policy;
- prefetching behavior;
- stable versus submission-specific data boundaries.

This investigation does not yet exist as a dedicated docs file, but #59 strongly suggests it should.

### Documentation/agent investigations own

- how investigations/plans are indexed;
- when to extract ADRs or design docs;
- how agents should discover and apply these documents.

## Candidate next steps

1. Keep #117 as the lightweight roadmap issue for sequencing DX, documentation, and refactor work.
2. Use `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md` as a proposed direction, not as an active implementation plan.
3. Create a smaller active plan only when starting a concrete extraction, such as assessment save or question/rubric save.
4. Create a dedicated caching/loading investigation for #59 if source/read-model refactors proceed.
5. When implementation starts, create focused issues rather than using #115 as one giant refactor task.
6. Extract ADRs only after decisions converge, especially for:
   - project slug storage;
   - identifier naming convention;
   - assessment command boundary;
   - source organization convention;
   - accepted read-write separation conventions.
