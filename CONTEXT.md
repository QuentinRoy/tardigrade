# Grading

This context defines the core domain language used in the grading product so contributors can distinguish stable public identifiers from internal database keys.

## Language

**Project ID**:
Stable public project identifier used in URLs and external-facing import/export references.
_Avoid_: public_id, internal project id, numeric project key

**Project Row ID**:
Internal surrogate database key for a project row, used for joins and foreign keys.
_Avoid_: project id (when meaning internal), public project id

**Project Slug**:
Human-readable URL segment derived from a project's name; cosmetic and may be stale. Not an identifier — the **Project ID** resolves the project.
_Avoid_: project identifier, lookup key, permalink

**Canonical Project URL**:
A project URL whose **Project Slug** segment matches the project's current slug. Identity always resolves from the **Project ID**, so a stale slug is corrected cosmetically in place rather than forcing a redirect.
_Avoid_: correct URL, real URL

**DB Boundary**:
Project Row ID stays inside database read/write functions and must not leave that layer.
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

**Project Read Model**:
Project read outputs expose only Project ID for identity.
_Avoid_: exposing Project Row ID in read models

**Project Resolution Strategy**:
Database operations are built from Project ID directly, with in-query resolution to internal relational keys as needed.
_Avoid_: dedicated pre-resolution helper requests that add extra round trips

**Project ID Migration Default**:
DB-facing APIs should migrate to Project ID inputs by default.
_Avoid_: retaining Project Row ID API boundaries unless complexity or performance impact is clearly demonstrated and accepted

**Project Row ID Exception Bar**:
Keeping Project Row ID at a DB API boundary is allowed only when a measured regression exists, no reasonable query or index rewrite fixes it, and the exception remains DB-internal, documented, and tested.
_Avoid_: convenience-based exceptions without evidence

**Test Helper Boundary**:
Test helpers should expose Project ID by default; Project Row ID may remain internal only inside DB-facing cleanup or fixture plumbing that never leaves the helper.
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
The gradeable shape — a label plus its **Criteria** (and optional solution) — consumed when assessing, exporting, or scoring a submission. What a rubric _is_ at grading time. Previously called "Question"; renamed because the container is not always question-shaped (e.g. a report section) and one rubric always grids exactly one gradable section, so the section and its grid are one concept.
_Avoid_: question, rubric grid (the rubric _is_ the grid, not a separate thing that has one)

**Rubric Definition**:
The authored/configured representation of a **Rubric** surfaced in the management UI: the Rubric plus definition-level metadata such as position, linked-assessment count, and delete impact. What an author _edits_.
_Avoid_: managed question, ManagedQuestion, question definition

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

### Assessment

**Assessment**:
The recorded evaluation of a **Criterion** for a submission — criteria are what get assessed. A rubric or submission is _fully assessed_ when **Assessment Completion** holds for it. The rubric-level grouping record in persistence is a container, not a second kind of assessment.
_Avoid_: treating "assessment" and "criterion assessment" as distinct domain concepts

**Assessment Completion**:
Assessments are what get completed; submissions, rubrics, and projects are grouping dimensions, never owners of completion. The assessment of a **Rubric** for a submission is complete when every **Criterion** of that rubric has a recorded assessment value. A rubric with no criteria has a complete assessment — nothing remains to assess. Completion is vacuously true without exception: aggregates over an empty grouping (no submissions, no rubrics) are complete, not zero. Whether to show completion for an empty project is a presentation concern, not a completion exception. One rule, applied identically across every grouping and on every surface (server projections and client summaries).
_Avoid_: rubric completion, submission progress, "a submission has progress", per-view completion rules, treating zero-criterion rubrics as incomplete, empty-grouping special cases

## Flagged Ambiguities

- project id: previously overloaded in discussion and code. Resolution: Project ID means public identifier by default. Project Row ID must be named explicitly and is DB-internal only.
- rubric vs assessment value: `rubric` was used for both the gradeable shape (`AssessedRubric`/`Rubric`) and the graded value (`AssessmentRubricValue`), and the value also appeared as `rubricValue`, `right`, and `value`. Resolution: the gradeable-shape word never doubles as the value word; an `AssessmentRubricValue` is always named `assessment`. The session save callback and the DB-facing param that carry the value are `saveAssessment`/`assessment`, never a shape-named equivalent. Terminology note: at the time of this resolution the gradeable shape in question was named `Rubric`; it is now **Criterion** (see Rubric authoring) — the code identifiers (`AssessedRubric`, `RubricAssessment`, `rubricId`) predate that rename and are tracked for a follow-up code refactor, not renamed by this glossary update alone.

## Example Dialogue

Developer: Should this endpoint accept Project Row ID?

Domain expert: No. The API takes Project ID, because callers use the public project reference.

Developer: Then we resolve Project ID to Project Row ID before joining related tables?

Domain expert: Exactly. Project Row ID stays internal to persistence and joins.
