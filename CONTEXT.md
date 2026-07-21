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
A feature persistence function that performs database work only, against a required Kysely handle. Reads use the `…FromDb` suffix and accept `Kysely<DB>` (the global client or a transaction); writes use the `…InDb` suffix and require `Transaction<DB>`, so they can only run inside a transaction. It never opens a transaction and never invalidates cache.
_Avoid_: repository, dao, data-access object

**App-Level Wrapper**:
The bare-named app-facing function that owns the global database handle, transaction boundaries, and cache invalidation, delegating database work to one or more **DB Primitives**. The owner of a transaction invalidates cache after it commits.
_Avoid_: service, manager, orchestrator (as a type name)

### Roster

**Student**:
A person imported or created within a Grid, identified by a stable id independent of display name. Belongs to at most one **Grade Target** per Grid (the **Partition Rule**). "Participant" was considered as a more generic alternative and declined: the product's users are educators and every roster member is graded, so the specific word carries more information — and Moodle needs "Participants" only because its rosters are multi-role. If a non-education audience ever materializes, the rename is shallow because **Grade Target** carries identity, and the right word can be chosen then from what those users call themselves.
_Avoid_: participant, user (both imply broader platform-level identity; a Student is Grid-scoped)

**Grade Target**:
The single entity that occupies one row of a Grid: a set of one or more Students, identified by a stable id independent of its current display label or composition, following the established `id`/`row_id` convention (Grade Target ID / Grade Target Row ID). It carries an optional **Group Name** and its **Membership**; persistence does not distinguish individual from group (see ADR 0014). Deliberately a code/dev-facing concept only: user-facing copy names the Student or Group directly, never "Grade Target" — see the Lexicon.
_Avoid_: submission (implies submitted work; wrong for ad hoc or no-submission targets), target (bare — reads as generic programming vocabulary), assessment target (reintroduces the retired "assessment" word), individual/group as persisted kinds (they are presentation shapes — see **Group**, **Individual**)

**Membership**:
The set of Students belonging to a **Grade Target**, persisted one row per (Grade Target, Student). A Student in a target is a **member**. Every Grade Target has at least one member, guaranteed at the write boundary (not a database CHECK, since membership is a join table); readers fail loudly on a memberless target rather than substituting a label. Zero-member (draft) targets are a deliberate non-goal here, deferred to #61.
_Avoid_: student_to_group (the retired join name), roster (that is the Grid's Students, not one target's members)

**Partition Rule**:
Each Student belongs to at most one **Grade Target** per Grid. Moving a Student between targets is a reassignment, never a fork, so grid-wide Totals and **Grade Completion** never double-count a Student.
_Avoid_: a Student graded both solo and in a group (a separate future feature, not this model)

**Group**:
A presentation shape of a **Grade Target**, not a persisted entity: a target that has a **Group Name** OR more than one member. Renders with the group name and member list. Previously a table (and before that "Team"); the table is gone (ADR 0014) — "Group" now names how a multi-member or named target is presented, over the one Grade Target model. A named single-member target is still a Group (the author gave it a name). Covers pairs, ad hoc lab groups, and imported Moodle groups.
_Avoid_: team, participant, a separate group table or `group_row_id` (retired), treating Group as a persisted kind

**Individual**:
A presentation shape of a **Grade Target**, not a persisted entity: a target with exactly one member and no **Group Name**, rendered as that single Student. An Individual never carries a name. The complement of **Group** under the name-OR-multimember rule.
_Avoid_: an `individual` kind value or `student_row_id` column (retired), treating Individual as a persisted kind

**Group Name**:
The optional name of a **Grade Target**, unique per Grid among non-null names. Only a **Group** carries one; an **Individual** leaves it null and derives its label from its single Student. The name is import's find-or-create key for a group; it is a display label, not identity (the **Grade Target ID** resolves the target).
_Avoid_: target name (only groups have one), using the name as identity

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
The gradeable shape — a label plus its **Criteria** — consumed when grading, exporting, or scoring a Grade Target. What a rubric _is_ at grading time. Previously called "Question"; renamed because the container is not always question-shaped (e.g. a report section) and one rubric always grids exactly one gradable section, so the section and its grid are one concept.
_Avoid_: question, rubric grid (the rubric _is_ the grid, not a separate thing that has one)

**Rubric Definition**:
The authored/configured representation of a **Rubric** surfaced in the management UI: the Rubric plus definition-level metadata such as position, linked-grade count, and delete impact. What an author _edits_.
_Avoid_: managed question, ManagedQuestion, question definition, linked-assessment count

**Criterion**:
One graded item within a **Rubric**, of one of three kinds: **Check** (a yes/no question, each answer worth its own marks with no built-in pass/fail — was "boolean"), **Options** (one of several labeled options, unordered and allowed to share marks — was "ordinal"), or **Number** (a measured value mapped to marks — was "numerical"). The classifier is **kind**, not "type", matching the grade row's `kind` (see **Grade Target**, and the Lexicon's Kind entry). One vocabulary across code, DB enum, YAML, and UI; the old kind ids (`boolean`/`ordinal`/`numerical`) are renamed by the sweep, not kept as an internal layer. "Options" is also more accurate than "ordinal": the schema stores no order. Criterion was previously called "Rubric"; renamed because "Rubric" now names the whole grid (Moodle/Gradescope/Canvas), not a single graded item.
_Avoid_: rubric (when meaning a single graded item), boolean, ordinal, numerical, scale/rating/levels (imply an order the model does not have)

**Criterion Definition**:
The authored/configured representation of a **Criterion** within a **Rubric Definition** — its full marks configuration and metadata as edited by an author.
_Avoid_: managed rubric, ManagedRubric, rubric definition (when meaning a single item's configuration)

**Criterion Subtype Invariant**:
Every persisted **Criterion** carries its kind-specific configuration: Check and Number configuration rows always exist, and an Options criterion satisfies the **Options Marks Minimum**. Readers fail loudly on a violation instead of substituting defaults; write boundaries make the invalid state unrepresentable.
_Avoid_: silent zero-marks fallback, tolerant read-side defaults, rubric subtype invariant

**Options Marks Minimum**:
An Options **Criterion Definition** must define at least two mark entries, enforced identically at every write boundary (editor and import). An Options criterion is a choice between labels; fewer than two is not an authorable state.
_Avoid_: empty options marks as a draft state, per-boundary minimums that disagree, ordinal marks minimum

**Number Criterion Bounds**:
A Number **Criterion Definition** must satisfy `minValue < maxValue` (a collapsed or inverted value range is not authorable) and `minMarks <= maxMarks` (marks may be flat but not inverted). Both are enforced identically at every write boundary — editor, import, and a DB CHECK. The marking function is a pure computer: it trusts validated inputs and throws only on a zero-width value range, the one case that would otherwise yield `NaN` rather than a finite mark.
_Avoid_: zero-width or inverted value ranges, inverted marks ranges, tolerant `NaN` marks, per-boundary rules that disagree, re-validating criterion shape inside the marking function, numerical criterion bounds

### Criterion overview

**Grade Matrix**:
The per-target criterion-by-criterion overview table: one row per **Grade Target**, one cell per criterion's **Grade**, each cell rendered as the **Mark** it earns (the one representation comparable across criterion kinds), plus totals and completion. Distinct from **Criterion Analytics** (the per-criterion aggregate view). Previously "Submission Matrix" (renamed with the submission-to-Grade-Target move). Internal name only: "matrix" is not user-facing vocabulary — the UI calls this table "Grades" and its first column "Name" (see the Lexicon).
_Avoid_: submission matrix, student matrix, per-student grid, "Matrix" in UI copy

**Criterion Analytics**:
The per-criterion aggregate table on the **Results** page, showing each criterion's average marks and completion across **Grade Targets**. Distinct from the **Grade Matrix** (the per-target view). Previously "Rubric Analytics"; renamed because "Rubric" now names the whole grid, not a single graded item.
_Avoid_: rubric analytics, rubric matrix, rubric summary table

### Grade

**Grade**:
The recorded evaluation of a **Criterion** for a Grade Target — criteria are what get graded. A rubric or Grade Target is _fully graded_ when **Grade Completion** holds for it. In persistence a grade is one row per (Grade Target, Criterion); there is no rubric-level grouping record. Previously two separate word families, "assess/assessment" and "grade"; consolidated to one (grade / to grade / grading) because keeping both alive was semantically too close and invited drift. The aggregate result across criteria or rubrics is **Total**, never "grade" — grade always names the atomic per-criterion record or the act of producing it.
_Avoid_: assessment, assess, treating "grade" and "criterion grade" as distinct domain concepts, using "grade" for the aggregate (see **Total**)

**Value**:
The number a **Number** **Criterion**'s **Grade** records (for example "12 subnets identified"), mapped to a **Mark** by the criterion's configuration (`minValue..maxValue → minMarks..maxMarks`). A payload name, not a pipeline stage: the value pipeline is Grade → Mark → **Total** for every criterion kind, and value is simply what a Number grade's content is called — the same rank as a Check grade's Yes/No answer or an Options grade's label. Never an aggregate (that is a **Total**). Replaces "score", which is fully retired (it read as a good-thing tally, wrong for a reversed Number criterion where a higher value earns fewer marks). Use `criterionValue` in code where bare `value` is ambiguous.
_Avoid_: score (fully retired), mark, points, "value → grade → mark" as a pipeline, using "value" for Check/Options criteria or for the aggregate

**Mark**:
The numeric value a **Grade** is worth, computed from the criterion's marks configuration. Grades are facts, marks are policy: retuning a criterion's marks configuration recomputes marks while every recorded grade survives untouched. Marks sum into **Totals**.
_Avoid_: points, value (a mark is the worth, not the entered value), storing marks as if they were recorded facts

**Total**:
The aggregate of **Marks** across a grouping — a rubric total or a grid-wide final total. The only value-family word for aggregates.
_Avoid_: grade (for the aggregate), sum, grand total

**Grade Completion**:
Grades are what get completed; Grade Targets, rubrics, and grids are grouping dimensions, never owners of completion. The grading of a **Rubric** for a Grade Target is complete when every **Criterion** of that rubric has a recorded grade. A rubric with no criteria is fully graded — nothing remains to grade. Completion is vacuously true without exception: aggregates over an empty grouping (no Grade Targets, no rubrics) are complete, not zero. Whether to show completion for an empty grid is a presentation concern, not a completion exception. One rule, applied identically across every grouping and on every surface (server projections and client summaries).
_Avoid_: assessment completion, rubric completion, "grade target progress", "a grade target has progress", per-view completion rules, treating zero-criterion rubrics as incomplete, empty-grouping special cases

## Flagged Ambiguities

- grid id: previously overloaded in discussion and code (when this concept was named `Project`). Resolution: Grid ID means public identifier by default. Grid Row ID must be named explicitly and is DB-internal only.
- project vs grid: `Project` implied a 1:1 mapping to one real-world gradable event (a test, a report). That broke down in practice: some real-world events must be split across multiple containers because different parts need different Grade Target groupings (individual vs. Group), and the app has no way to aggregate across that split. Resolution: the top-level container is named **Grid**, describing its actual fixed row/column structure rather than claiming to be a single pedagogical event. Terminology note: the code identifiers that predated this rename have since been renamed to match — `project` → `grid`, `projectId` → `gridId`, `ProjectRowId` → `GridRowId`, route segments such as `/projects/[projectId]` → `/grids/[gridId]`.
- rubric vs assessment/grade value: `rubric` was used for both the gradeable shape (`AssessedRubric`/`Rubric`) and the graded value (`AssessmentRubricValue`), and the value also appeared as `rubricValue`, `right`, and `value`. Resolution: the gradeable-shape word never doubles as the value word; the recorded value is always named `grade` (formerly `assessment`) going forward. Terminology note: the gradeable shape in question was named `Rubric` at the time, then **Criterion** (see Rubric authoring); the code identifiers that predated both this rename and the assessment-to-grade rename below have since been renamed to match — `AssessedRubric` → `GradedCriterion`, `RubricAssessment` → `CriterionGrade`, leaf `rubricId` → `criterionId`, `saveAssessment` → `saveCriterionGrade`.
- grade granularity: `grade` now names the atomic per-criterion record, the act of producing it ("to grade"), and — colloquially, outside this glossary — what most people mean by "my grade" (the overall result). Resolution: only the aggregate has a distinct word, **Total**; every other use of `grade` refers to the atomic record, disambiguated by a qualifying phrase ("criterion grade", "final total") rather than a different root word. This mirrors how **Assessment** was already used across multiple grains before this rename, so it is a continuation of existing practice, not a new risk.

## Example Dialogue

Developer: Should this endpoint accept Grid Row ID?

Domain expert: No. The API takes Grid ID, because callers use the public grid reference.

Developer: Then we resolve Grid ID to Grid Row ID before joining related tables?

Domain expert: Exactly. Grid Row ID stays internal to persistence and joins.
