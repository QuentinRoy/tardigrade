# Grading

This context defines the core domain language used in the grading product so contributors can distinguish stable public identifiers from internal database keys.

## Language

**Grid**:
The top-level gradeable container: a fixed set of **Rubric** columns and submission rows whose intersecting cells hold assessments. Named for its structure, not for a specific pedagogical shape — it may represent a whole exam, a report, or only one part of a larger real-world assessment. Previously called "Project"; that word implied a 1:1 mapping to one real-world gradable event, which breaks down when one event (e.g. a paper test) must be split across multiple containers because different parts need different submission groupings. One real-world event may therefore be represented by multiple Grids; the app does not aggregate across Grids today.
_Avoid_: project, test, exam, assignment (none of these are guaranteed 1:1 with a single real-world event)

**Grid ID**:
Stable public grid identifier used in URLs and external-facing import/export references.
_Avoid_: public_id, internal grid id, numeric grid key, project id

**Grid Row ID**:
Internal surrogate database key for a grid row, used for joins and foreign keys.
_Avoid_: grid id (when meaning internal), public grid id, project row id

**Grid Slug**:
Human-readable URL segment derived from a grid's name; cosmetic and may be stale. Not an identifier — the **Grid ID** resolves the grid.
_Avoid_: grid identifier, lookup key, permalink

**Canonical Grid URL**:
A grid URL whose **Grid Slug** segment matches the grid's current slug. Identity always resolves from the **Grid ID**, so a stale slug is corrected cosmetically in place rather than forcing a redirect.
_Avoid_: correct URL, real URL

**DB Boundary**:
Grid Row ID stays inside database read/write functions and must not leave that layer.
_Avoid_: leaking row_id into routes, UI models, import/export contracts

**System-wide Row ID Boundary**:
For every feature, row identifiers are internal relational keys and must not leak beyond DB read/write boundaries.
_Avoid_: exposing any `rowId` in app-facing contracts unless an approved exception exists

**Schema Alignment Rule**:
App-level types that correlate to DB schema should derive from the **Generated DB Schema Type** whenever practical to prevent drift. This concerns generated database types (kysely `generated/`), not a **Validation Schema**.
_Avoid_: manually duplicated enum/shape definitions that can diverge from generated schema

**Generated DB Schema Type**:
A TypeScript type generated from the database schema (kysely `src/db/generated/`). The source of truth for DB-correlated app types under the **Schema Alignment Rule**.
_Avoid_: calling these "schemas" unqualified; conflating them with a **Validation Schema**

**Validation Schema**:
A zod schema at a feature's input boundary that parses untrusted input into a typed value. A pure leaf: it imports only zod (and other schema leaves), never `src/db` or a sibling feature.
_Avoid_: bare "schema", parser, DTO

**Derived Input Type**:
The `z.output` of a **Validation Schema** — the single source of truth for what a write command accepts. The command is co-located with the schema it consumes.
_Avoid_: a hand-written input type that parallels a schema; `z.infer` of the input shape, which diverges under `.transform()`/`.default()`

**Grid Read Model**:
Grid read outputs expose only Grid ID for identity.
_Avoid_: exposing Grid Row ID in read models

**Grid Resolution Strategy**:
Database operations are built from Grid ID directly, with in-query resolution to internal relational keys as needed.
_Avoid_: dedicated pre-resolution helper requests that add extra round trips

**Grid ID Migration Default**:
DB-facing APIs should migrate to Grid ID inputs by default.
_Avoid_: retaining Grid Row ID API boundaries unless complexity or performance impact is clearly demonstrated and accepted

**Grid Row ID Exception Bar**:
Keeping Grid Row ID at a DB API boundary is allowed only when a measured regression exists, no reasonable query or index rewrite fixes it, and the exception remains DB-internal, documented, and tested.
_Avoid_: convenience-based exceptions without evidence

**Test Helper Boundary**:
Test helpers should expose Grid ID by default; Grid Row ID may remain internal only inside DB-facing cleanup or fixture plumbing that never leaves the helper.
_Avoid_: forcing fixture consumers to handle row IDs when the public identifier is sufficient

**Cutover Strategy**:
Boundary contract changes use hard cutover per module, not dual-accept signatures.
_Avoid_: temporary number-or-string APIs that prolong identifier ambiguity

### Persistence layer

**DB Primitive**:
A feature persistence function that performs database work only, against a required Kysely handle (the global client or a transaction). Reads use the `…FromDb` suffix, writes the `…InDb` suffix. It never opens a transaction and never invalidates cache.
_Avoid_: repository, dao, data-access object

**App-Level Wrapper**:
The bare-named app-facing function that owns the global database handle, transaction boundaries, and cache invalidation, delegating database work to one or more **DB Primitives**. The owner of a transaction invalidates cache after it commits.
_Avoid_: service, manager, orchestrator (as a type name)

### Roster

**Student**:
A person imported or created within a Grid, identified by a stable id independent of display name. May belong to zero or more Groups.
_Avoid_: participant, user (both imply broader platform-level identity; a Student is Grid-scoped)

**Group**:
One or more students treated as a single unit for assessment. Previously called "Team"; renamed because "Team" implies persistent collaboration, while a Group naturally covers pairs, ad hoc lab groups, and imported Moodle groups without that connotation. A Group of size one can represent an individual assessment target without a separate persistence branch — this is a candidate future direction (see the assessment target model investigation), not yet a decided structural change; only the word is settled here.
_Avoid_: team, participant (a participant is a single person; a Group may contain several)

**Grade Target**:
The entity that occupies one row of a Grid — currently either an individual Student or a Group — identified by a stable id independent of its current display label or composition, following the established `id`/`row_id` convention (Grade Target ID / Grade Target Row ID). Whether Student and Group remain separate persistence branches or unify under Group (a singleton Group representing an individual) is still an open question — see the assessment target model investigation and #61; this term does not commit to either outcome. Deliberately a code/dev-facing concept only: user-facing copy names the Student or Group directly, never "Grade Target" — see the Lexicon.
_Avoid_: submission (implies submitted work; wrong for ad hoc or no-submission targets), target (bare — reads as generic programming vocabulary), assessment target (reintroduces the retired "assessment" word)

### Import

**Import Plan**:
The output of an import's prepare stage: the values that would be written plus structured diagnostics such as ignored columns, unmatched or ambiguous targets, invalid cells, and possible overwrites. A future preview renders an Import Plan; the write stage executes one.
_Avoid_: import result, prepared import, preview (when meaning the data rather than UI)

**Blocking Diagnostic**:
An **Import Plan** diagnostic that prevents the write stage from executing. An import whose plan contains any blocking diagnostic writes nothing, consistent with the all-or-nothing import policy.
_Avoid_: warning (when the import must not proceed), silent skip

**Ignored Column**:
A recognized import column that is intentionally not imported because it is derived export output (for example marks columns). Reported in the **Import Plan**; never a **Blocking Diagnostic**. Unknown columns are not Ignored Columns — they block.
_Avoid_: unknown column, unrecognized column (those block)

### Rubric authoring

**Rubric**:
The gradeable shape — a label plus its **Criteria** (and optional solution) — consumed when grading, exporting, or scoring a Grade Target. What a rubric _is_ at grading time. Previously called "Question"; renamed because the container is not always question-shaped (e.g. a report section) and one rubric always grids exactly one gradable section, so the section and its grid are one concept.
_Avoid_: question, rubric grid (the rubric _is_ the grid, not a separate thing that has one)

**Rubric Definition**:
The authored/configured representation of a **Rubric** surfaced in the management UI: the Rubric plus definition-level metadata such as position, linked-grade count, and delete impact. What an author _edits_.
_Avoid_: managed question, ManagedQuestion, question definition, linked-assessment count

**Criterion**:
One boolean, ordinal, or numerical graded item within a **Rubric**. Previously called "Rubric"; renamed because "Rubric" now names the whole grid, matching standard usage (Moodle/Gradescope/Canvas), not a single graded item.
_Avoid_: rubric (when meaning a single graded item)

**Criterion Definition**:
The authored/configured representation of a **Criterion** within a **Rubric Definition** — its full marks configuration and metadata as edited by an author.
_Avoid_: managed rubric, ManagedRubric, rubric definition (when meaning a single item's configuration)

**Criterion Subtype Invariant**:
Every persisted **Criterion** carries its type-specific configuration: boolean and numerical configuration rows always exist, and an ordinal criterion satisfies the **Ordinal Marks Minimum**. Readers fail loudly on a violation instead of substituting defaults; write boundaries make the invalid state unrepresentable.
_Avoid_: silent zero-marks fallback, tolerant read-side defaults, rubric subtype invariant

**Ordinal Marks Minimum**:
An ordinal **Criterion Definition** must define at least two mark entries, enforced identically at every write boundary (editor and import). An ordinal criterion is a choice between labels; fewer than two is not an authorable state.
_Avoid_: empty ordinal marks as a draft state, per-boundary minimums that disagree

**Numerical Criterion Bounds**:
A numerical **Criterion Definition** must satisfy `minScore < maxScore` (a collapsed or inverted score range is not authorable) and `minMarks <= maxMarks` (marks may be flat but not inverted). Both are enforced identically at every write boundary — editor, import, and a DB CHECK. The marking function is a pure computer: it trusts validated inputs and throws only on a zero-width score range, the one case that would otherwise yield `NaN` rather than a finite mark.
_Avoid_: zero-width or inverted score ranges, inverted marks ranges, tolerant `NaN` marks, per-boundary rules that disagree, re-validating criterion shape inside the marking function

### Criterion overview

**Submission Matrix**:
The per-submission criterion-by-criterion overview grid on the assessment overview page, showing each submission's marks per criterion. Distinct from **Criterion Analytics** (the per-criterion aggregate view). Submission, not student, because a submission may be by a team.
_Avoid_: Student Matrix, student row, per-student grid, rubric-by-rubric (superseded: a rubric is now a whole grid, not a single column)

**Criterion Analytics**:
The per-criterion aggregate overview grid on the assessment overview page, showing each criterion's average marks and completion across submissions. Distinct from the **Submission Matrix** (the per-submission view). Previously "Rubric Analytics"; renamed because "Rubric" now names the whole grid, not a single graded item.
_Avoid_: rubric analytics, rubric matrix, rubric summary table

### Grade

**Grade**:
The recorded evaluation of a **Criterion** for a Grade Target — criteria are what get graded. A rubric or Grade Target is _fully graded_ when **Grade Completion** holds for it. The rubric-level grouping record in persistence is a container, not a second kind of grade. Previously two separate word families, "assess/assessment" and "grade"; consolidated to one (grade / to grade / grading) because keeping both alive was semantically too close and invited drift. The aggregate result across criteria or rubrics is **Total**, never "grade" — grade always names the atomic per-criterion record or the act of producing it.
_Avoid_: assessment, assess, treating "grade" and "criterion grade" as distinct domain concepts, using "grade" for the aggregate (see **Total**)

**Grade Completion**:
Grades are what get completed; Grade Targets, rubrics, and grids are grouping dimensions, never owners of completion. The grading of a **Rubric** for a Grade Target is complete when every **Criterion** of that rubric has a recorded grade. A rubric with no criteria is fully graded — nothing remains to grade. Completion is vacuously true without exception: aggregates over an empty grouping (no Grade Targets, no rubrics) are complete, not zero. Whether to show completion for an empty grid is a presentation concern, not a completion exception. One rule, applied identically across every grouping and on every surface (server projections and client summaries).
_Avoid_: assessment completion, rubric completion, "grade target progress", "a grade target has progress", per-view completion rules, treating zero-criterion rubrics as incomplete, empty-grouping special cases

## Flagged Ambiguities

- grid id: previously overloaded in discussion and code (when this concept was named `Project`). Resolution: Grid ID means public identifier by default. Grid Row ID must be named explicitly and is DB-internal only.
- project vs grid: `Project` implied a 1:1 mapping to one real-world gradable event (a test, a report). That broke down in practice: some real-world events must be split across multiple containers because different parts need different Grade Target groupings (individual vs. Group), and the app has no way to aggregate across that split. Resolution: the top-level container is named **Grid**, describing its actual fixed row/column structure rather than claiming to be a single pedagogical event. The code identifiers (`project`, `projectId`, `ProjectRowId`, route segments such as `/projects/[projectId]`) predate this rename and are tracked for a follow-up code/route refactor, not renamed by this glossary update alone.
- rubric vs assessment/grade value: `rubric` was used for both the gradeable shape (`AssessedRubric`/`Rubric`) and the graded value (`AssessmentRubricValue`), and the value also appeared as `rubricValue`, `right`, and `value`. Resolution: the gradeable-shape word never doubles as the value word; the recorded value is always named `grade` (formerly `assessment`) going forward. Terminology note: the gradeable shape in question was named `Rubric` at the time, then **Criterion** (see Rubric authoring); the code identifiers (`AssessedRubric`, `RubricAssessment`, `rubricId`, `saveAssessment`) predate both this rename and the assessment-to-grade rename below, and are tracked for a follow-up code refactor, not renamed by this glossary update alone.
- grade granularity: `grade` now names the atomic per-criterion record, the act of producing it ("to grade"), and — colloquially, outside this glossary — what most people mean by "my grade" (the overall result). Resolution: only the aggregate has a distinct word, **Total**; every other use of `grade` refers to the atomic record, disambiguated by a qualifying phrase ("criterion grade", "final total") rather than a different root word. This mirrors how **Assessment** was already used across multiple grains before this rename, so it is a continuation of existing practice, not a new risk.

## Example Dialogue

Developer: Should this endpoint accept Grid Row ID?

Domain expert: No. The API takes Grid ID, because callers use the public grid reference.

Developer: Then we resolve Grid ID to Grid Row ID before joining related tables?

Domain expert: Exactly. Grid Row ID stays internal to persistence and joins.
