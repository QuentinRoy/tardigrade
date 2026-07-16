# Organise each criterion kind as a vertical module under `src/criteria`

- **Status:** Accepted
- **Created:** 2026-07-16
- **Related:** [ADR 0010](0010-organize-src-as-enforced-vertical-layers.md), [ADR 0002](0002-db-is-infrastructure-features-own-persistence.md), [ADR 0007](0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md), [ADR 0004](0004-avoid-barrel-files.md), [criterion-kind ownership investigation](../investigations/2026-07-16-criterion-kind-ownership-and-persistence.md), #273

## Context

Check, Options, and Number knowledge is spread across ~20 production files: parallel domain/editor/command/read shapes, criterion-definition persistence duplicated between `rubric-management` and `imports`, generic grading/results reading kind-specific storage props, and the Number bounds invariant hand-written four-plus times. Some propagation is necessary (a real editor, DB, or public-contract change); much is accidental. The [investigation](../investigations/2026-07-16-criterion-kind-ownership-and-persistence.md) compared **horizontal capability modules** (extract pure domain only) against **criterion-kind vertical modules** (a source folder per kind spanning tiers).

## Decision

Each criterion kind is a stable source folder — `src/criteria/{check,options,number}/` — owning everything that is *only* about that kind: canonical config and grade-content types, defaults/marking/bounds/validation, editor and YAML-import schema leaves, criterion-definition **and** grade subtype persistence adapters (write **and** row→config read hydration), kind-specific leaf UI (grade control + authoring fields fragment + details projection), YAML encode/decode, and tests. Generic Criterion files **above** the folders own the `Criterion`/`CriterionGrade` discriminated unions, exhaustive dispatch, cross-kind batching, transaction coordination, and a static union-keyed kind map. Values stay plain serializable discriminated unions — no runtime classes, registry, or discovery.

Kind folders are shared-domain leaves (import only design-system, infra, and intra-shared-domain), so persistence adapters may import `#db` while remaining downward-importable. Client/server separation is guaranteed by `import "server-only"`, with the invariant that shared pure files stay import-clean.

## Alternatives considered

- **Horizontal capability modules** — rejected: leaves one kind's implementation spread across `criteria`, `rubric-management`, `export`, and `imports`; fails the deletion test; keeps whole-codebase navigation.
- **Runtime registration / discovery / third-party kinds / class hierarchies / generic repository** — rejected (explicit non-goals): kinds are statically known and exhaustiveness must stay compiler-forced.
- **Cross-boundary shared schema base** — rejected: it re-couples the YAML contract to the editor representation; consistency of *rules* is instead delivered by a shared per-kind domain invariant, not a shared schema shape.

## Consequences

- **A deliberate, scoped exception to [ADR 0010](0010-organize-src-as-enforced-vertical-layers.md) rule 5.** Criterion-kind UI lives in shared-domain `criteria` by *identity*, not by rule 5's "multiple real consumers" bar (the grade controls already sit there with a single consumer). The exception is bounded to criterion-kind leaf UI; general promotion still follows rule 5.
- `criteria` becomes a **client-and-server** shared-domain module (grade/editor leaf UI beside `server-only` persistence in sibling files).
- **Legal with no new import-direction tooling** — `.dependency-cruiser.js` already enforces the needed layer direction; no path-based public-surface rule exists to block kind subfolders.
- Criterion-definition persistence's generic coordinator moves **down to `criteria`**, scoped to criterion row-id resolution, group-by-kind, and subtype-adapter dispatch — the genuinely duplicated part of `rubric-management` and `imports`. The criterion base-row insert/update/delete stays in each vertical (their semantics legitimately differ: rename-by-`previousId` loop vs batch upsert). By-kind batching and caller-owned transactions/cache are preserved (ADR 0002 / ADR 0007). Grade persistence and read hydration decompose the same way: kind validation, subtype writes, and row→config mapping live in the kind folders; `grade-persistence` and the generic hydrators keep context resolution, parent-row upsert, cross-kind clearing, and dispatch.
- Editor/command types collapse to the editor schema's `z.output`; the YAML-decode schema stays a distinct boundary value behind a stable adapter, so in-process changes cannot silently move the public format.
- No barrels (ADR 0004): consumers import concrete owning files; the union-keyed kind map is DRY, not a runtime registry.
- `CONTEXT.md` is unchanged — this is code organisation, not domain vocabulary.
- Execution is staged, behavior-preserving, and lands one kind at a time (Check first) in [`plans/2026-07-16-criterion-kind-vertical-modules.md`](../../plans/2026-07-16-criterion-kind-vertical-modules.md).
