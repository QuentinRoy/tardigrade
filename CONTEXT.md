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

### Question authoring

**Question**:
The gradeable shape — a label plus its **Rubrics** (and optional solution) — consumed when assessing, exporting, or scoring a submission. What a question _is_ at grading time.
_Avoid_: question definition (when meaning the gradeable shape)

**Question Definition**:
The authored/configured representation of a **Question** surfaced in the management UI: the Question plus definition-level metadata such as position, linked-assessment count, and delete impact. What an author _edits_.
_Avoid_: managed question, ManagedQuestion

**Rubric Definition**:
The authored/configured representation of a **Rubric** within a **Question Definition** — its full marks configuration and metadata as edited by an author.
_Avoid_: managed rubric, ManagedRubric

## Flagged Ambiguities

- project id: previously overloaded in discussion and code. Resolution: Project ID means public identifier by default. Project Row ID must be named explicitly and is DB-internal only.

## Example Dialogue

Developer: Should this endpoint accept Project Row ID?

Domain expert: No. The API takes Project ID, because callers use the public project reference.

Developer: Then we resolve Project ID to Project Row ID before joining related tables?

Domain expert: Exactly. Project Row ID stays internal to persistence and joins.
