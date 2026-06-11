# `src/db` is database infrastructure; features own their persistence and validation

Status: accepted

`src/db` is database **infrastructure only** — the kysely client, generated DB schema types, migrations, and cache-tag plumbing — and must not import from any feature folder (`src/{assessment,export,import,projects,questions,rubrics,submissions}`), not even type-only. All feature-specific persistence — read models, write commands, **Domain Types**, and **Validation Schemas** — lives in the owning feature folder. A write command's accepted input is the **Derived Input Type** (`z.output` of its Validation Schema), never a hand-maintained parallel type, and the command is co-located with the schema it consumes.

## Why

Feature persistence currently living under `src/db` produces duplication and a back-pointing dependency: `src/db/questionsManaged.ts` hand-maintains `ManagedQuestionInput` to match `z.output<typeof managedQuestionSchema>` in `src/questions/schemas.ts` (kept in sync by hand, nothing enforces it), and `src/db/questionsCommands.ts` imports `QuestionsValidationError` from `@/questions/errors` — a runtime `db → feature` edge. The `import` feature already shows the target: `src/import/saveQuestions.ts` lives in the feature, accepts `z.output<typeof questionSchema>`, and depends only *down* on `../db/kysely`.

A `db → feature` edge cannot be partially allowed. If domain types or read models stay in `src/db` while schemas/commands move out, `src/db` must reach back up for them and the arrow returns. The only coherent end state is per-feature all-or-nothing — read model, write command, Domain Types, and Validation Schema all in the feature — leaving `src/db` with nothing feature-specific to import. This matches the "Candidate target shape" in the [source-structure audit](../investigations/2026-05-25-source-structure-and-tech-debt-audit.md), which this ADR promotes from proposed direction to accepted decision.

## Rules

1. `src/db` imports only from `src/db`, `src/shared`, and libraries — never from a feature folder, including `import type`. Intended to be lint-enforceable via a dependency-boundary rule.
2. A **Validation Schema** is a pure leaf: it imports only `zod` (and other schema leaves), never `src/db` or a sibling feature.
3. A write command's input is the **Derived Input Type** = `z.output<typeof schema>`. Never hand-write a type that parallels a schema; derive from `z.output`, not `z.infer` of the input shape (they diverge under `.transform()`/`.default()`, as in `src/import/schemas.ts`).
4. Transport/presentation/error-shaping stays in the feature/presentation layer (`JSON.parse` of FormData, delete-confirmation matching, zod-issue → field-error mapping). Only the structural input contract is shared, and it is derived.

## Considered Options

- **Keep the writer in `src/db`, derive the input type via a type-only `import type` from the schema** — rejected as the end state: it removes the duplication but leaves an erased `db → feature` edge pointing the wrong way and still requires relocating `QuestionsValidationError`.
- **Keep the writer in `src/db` with a hand-written input type synced to the schema (status quo)** — rejected: perpetuates an unenforced duplicate and the upward error import.
- **A dedicated shared `contracts/` schema layer** — rejected as over-engineered: zod appears in exactly two disjoint feature schemas (`questions`, `import`), the two question writers have no single convergence point, and `src/shared` already exists for genuinely cross-cutting code.

## Consequences

- The "derive the input type in `db` vs leave it hand-written" question dissolves: once a feature owns both its schema and its writer, the input is `z.output` of the schema and there is no cross-layer arrow to direct.
- Code that predates this decision still violates it (e.g. the `questions` writer and the `Domain Types` in `src/db/types.ts`). The physical relocations are correctness-sensitive write paths; they are tracked and sequenced in the [source-structure audit](../investigations/2026-05-25-source-structure-and-tech-debt-audit.md), not in this ADR.
- `CONTEXT.md` gains **Validation Schema** and **Derived Input Type**, and tightens **Schema Alignment Rule** to clarify it governs *Generated DB Schema Types* (kysely `generated/`), a distinct sense of "schema".
