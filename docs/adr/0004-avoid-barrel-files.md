# Avoid barrel files; import from the module that owns the implementation

Status: accepted

A **barrel file** is a module whose main purpose is to re-export symbols from sibling modules (the classic `index.ts` aggregator, or `src/db/questions.ts` re-exporting from `questionsRead.ts`/`questionsManaged.ts`/`questionsCommands.ts`). We avoid them: callers import from the concrete module that owns the implementation, so ownership is visible at the import site. A file named after a concept — `questions.ts` containing the actual question read implementation — is fine; what we reject is the re-export facade.

## Why

Barrels hide concrete ownership (you import from `questions.ts` with no idea which sibling actually defines the symbol), worsen auto-imports (tooling offers the barrel and the real module, and picking the barrel pulls in unrelated siblings), create circular-import paths, and force eager loading of every re-exported module even when one symbol is used. These are the concerns summarised in TkDodo's "Please Stop Using Barrel Files." Auto-import convenience — the usual reason a barrel appears — is explicitly **not** sufficient justification.

## Rules

1. Do not create a file whose primary purpose is to re-export symbols from sibling modules.
2. Import from the concrete module that owns the implementation.
3. A module named after a concept is fine when it *contains* that concept's implementation, not merely re-exports it.
4. A re-export facade is allowed only with an explicit documented reason — a stable public package boundary, or a narrow, temporary compatibility shim during a migration — and should be removed once the reason lapses.

No lint rule enforces this today: Biome has no clean "this file only re-exports siblings" detector, and the issue's scope deliberately excludes generic barrel linting. The rule is a convention; lint enforcement remains a possible future tightening if a low-blast-radius rule emerges (cf. [ADR-0003](0003-node-subpath-imports-and-ts-extensions.md), where import boundaries are Biome-enforced).

## Consequences

- `src/db/questions.ts` stops being a facade and becomes the real question read implementation; former importers of the facade now import from the concrete owning module.
- This is a convention agents and contributors must apply by hand, since nothing fails `pnpm check` when a barrel is introduced. `AGENTS.md` carries a short pointer to this ADR because creating an `index.ts` barrel is a near-universal reflex.
