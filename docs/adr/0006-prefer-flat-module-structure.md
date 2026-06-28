# Prefer flat module structure; split owners before nesting

- **Status:** Superseded
- **Created:** 2026-06-04
- **Superseded by:** [ADR 0010](0010-organize-src-as-enforced-vertical-layers.md)

> Superseded on 2026-06-28 by ADR 0010, which keeps flatness as the default *within* a module but replaces "flat is the intended end state" with enforced vertical layers. The flat-inside-a-module conventions and suffix rules below still apply; the "split owners into siblings before nesting; nesting is a last resort" stance does not.

Inside a feature folder (`src/{assessments,export,import,projects,questions,rubrics,submissions}`) and `src/ui`, default to a flat file layout. Use filename suffixes such as `*.action.ts`, `*.repository.ts`, `*.service.ts`, `*.types.ts`, `*.schema.ts`, and `*.test.ts` to show a file's role. Do not create technical category subfolders such as `repository/`, `service/`, `domain/`, `ui/`, `components/`, or `hooks/`.

If a folder becomes hard to scan, the first response is not to introduce technical subfolders. First ask whether the owner has become too broad and should be split into sibling feature folders under `src/` according to ADR-0002. Nesting inside an owner is a last-resort option for a genuinely single owner with distinct internal domain sub-areas, and those subfolders remain flat. Tool-imposed directories, such as `src/db/generated/` and `src/db/migrations/`, are exempt because their layout is not ours to choose.

This promotes the "Prefer flat modules first" principle in the [source-structure audit](../investigations/2026-05-25-source-structure-and-tech-debt-audit.md) from proposed direction to accepted decision. It does not govern framework-owned routing structure under `src/app/`.

## Why

Category-first folder trees (`domain/`, `application/`, `infrastructure/`, or `repositories/`, `services/`, `components/`) cost more than they give at this project's size. They scatter files that change together for one product reason across sibling category folders, add path depth without much information, and invite premature layering the codebase does not need.

The audit's [colocation principle](../investigations/2026-05-25-source-structure-and-tech-debt-audit.md#colocation-is-good-but-reason-to-change-matters) already establishes that files should sit near the workflow or domain concept they support. For example, `src/assessments/saveAssessment.action.ts`, `src/assessments/saveAssessment.ts`, and `src/assessments/saveAssessment.test.ts` are more useful together than split across `actions/`, `services/`, and `tests/`.

Suffixes carry the role information that category folders would otherwise provide while preserving reason-to-change colocation. A shared base name keeps one concept's files adjacent in a flat listing: `saveAssessment.ts`, `saveAssessment.action.ts`, and `saveAssessment.test.ts` sort together, so the concept's implementation, server boundary, and tests remain visible together. Category folders break this by grouping files according to framework mechanism rather than by what changes together.

This decision is about the shape within an ownership boundary. It is orthogonal to ADR-0002, which decides which owner a file belongs to, and ADR-0004, which avoids re-exporting across siblings. Together: ADR-0002 places a file in the right folder, this ADR keeps that folder flat by default, and ADR-0004 keeps imports pointed at the concrete owning module.

## Rules

1. Within a feature folder or `src/ui`, do not create technical category subfolders (`repository/`, `service/`, `domain/`, `ui/`, `components/`, `hooks/`, and the like). Use filename suffixes for that distinction instead.
2. Splitting an oversized module into more files is not a reason to nest. Keep those files flat and distinguish their roles by suffix.
3. If a folder becomes hard to scan, first ask whether the owner itself is too broad and should be split into sibling feature folders under `src/` according to ADR-0002.
4. Nest inside an owner only as a last resort, when it is still genuinely one owner but has distinct internal domain sub-areas. Group by domain sub-concept, not by technical category. Each subgroup remains flat.
5. Tool-imposed directories are exempt: `src/db/generated/` and `src/db/migrations/` follow their tooling's layout, not this rule. Document any further exemption at the point it is introduced.
6. Do not add a subfolder pre-emptively for a folder you expect to grow. Flatten first; split ownership if needed; nest only when the alternatives are worse.

No lint rule currently enforces this; like ADR-0004 it is a convention agents and contributors apply by hand. Enforcement remains a possible future tightening if a low-blast-radius rule emerges.

## Considered Options

- **Category-first layering (`domain/`/`application`/`infrastructure/`, or `repositories/`/`services/`/`components/`)**: rejected. It scatters reason-to-change-together files, adds depth without useful information, and pushes toward a clean-architecture hierarchy the project explicitly lists as a non-goal in the audit.
- **Flat with no escape hatch at all**: rejected. Tool-owned directories (`generated/`, `migrations/`) are not negotiable, and a future owner could theoretically need internal domain sub-areas. The escape hatch is intentionally narrow: split owners before nesting.
- **Leave it as an investigation principle only**: rejected. Investigations are provisional and sit low in the `AGENTS.md` precedence order, so nothing durable counters the category-folder reflex. Promoting the rule to an ADR makes it a binding convention, mirroring how ADR-0002 promoted the audit's target source shape.

## Consequences

- The audit's "Prefer flat modules first" principle becomes a binding convention rather than provisional guidance.
- The current flat shape of `src/ui` and the feature folders is the intended end state, not a transitional one.
- Folder growth is treated primarily as a possible ownership-boundary problem, not as a reason to add internal technical categories.
- The accepted tradeoff is that flat folders may contain more files than category-first structures, but they preserve fewer-clicks navigation, suffix-driven discoverability, and files that change together staying visible together.
- Any future nested feature subfolder is a deliberate, case-by-case exception for a domain sub-concept, not a default response to growth.
- `AGENTS.md` gains a short routing pointer, since reaching for category subfolders is a common reflex, similar to the ADR-0004 barrel-file pointer.