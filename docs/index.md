# Documentation index

This repository keeps docs small and purpose-built. Use this page to find the right document type quickly.

## Placement check

When adding or moving repository guidance, use the smallest document type that fits:

- Agent-operational rules and mandatory reminders belong in `AGENTS.md`.
- Workflow guidance belongs in `docs/guides/`.
- Durable facts about current system behavior belong in `docs/reference/`.
- Durable architecture decisions belong in `docs/adr/`.
- Chosen implementation designs belong in `docs/design/`.
- Open-ended audits and option analysis belong in `docs/investigations/`.
- Temporary execution plans belong in `plans/`.

## Document lifecycle

Use date-prefixed filenames for time-bound documents:

- `docs/investigations/YYYY-MM-DD-topic.md`
- `docs/design/YYYY-MM-DD-topic.md` when the design is tied to a specific implementation effort
- `plans/YYYY-MM-DD-topic.md`

Do not date-prefix stable canonical documents by default, such as guides, reference docs, and ADRs.

Every durable document carries a list-style metadata block (`Status`, `Created`, optional per-type fields) immediately below its title. The document types, their templates, the per-type status vocabulary, naming, and how documents retire are defined in the [documentation-conventions guide](guides/documentation-conventions.md). Plans use the block in [Plans](#plans) below.

## Investigations

Open-ended audits and option analysis. Investigations may contain hypotheses and candidate directions; they are not accepted decisions unless later captured in an ADR or implemented in code/tests.

### Product and domain investigations

- [Grading workflows and product positioning](investigations/2026-05-22-grading-workflows-and-product-positioning.md)
- [Mark, grade and weighting model](investigations/2026-05-20-mark-grade-weighting-model.md) — terminology resolved (Score → Mark → Total, Grade); aggregation model still open.

### Technical architecture investigations

- [Offline support and local assessment storage](investigations/2026-05-19-offline-support.md)

### Completed investigations

- [Assessment target model](investigations/2026-05-20-assessment-target-model.md) — resolved: structural model decided in ADR 0014 (unify grade targets as student sets); terminology already resolved (Group, Grade Target).
- [The `assessment` container table](investigations/2026-07-12-assessment-container-table.md) — resolved: drop the (grade target × rubric) grouping table (a day-one fossil) before the assessment → grade rename; executed as stage 5b of `plans/2026-07-06-terminology-sweep.md`.
- [Read-write separation and schema-change resilience](investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md) — direction accepted and implemented; remaining R-008 scope now executed via `plans/2026-06-22-rubric-overview-projection-extraction.md`.
- [Source structure and technical debt audit](investigations/2026-05-25-source-structure-and-tech-debt-audit.md) — all 8 prioritized backlog items Done; remaining narrow items deferred to #136 or intentionally deprioritized.
- [Caching and loading audit](investigations/2026-06-11-caching-loading-audit.md) — resolved; all 13 planned PRs landed, #59 closed.
- [Investigation overlap audit](investigations/2026-05-25-investigation-overlap-audit.md) — coordinated #115/#117 sequencing; all related issues are now closed.
- [Agent instruction architecture audit](investigations/2026-05-26-agent-instruction-architecture-audit.md)
- [Domain terminology audit](investigations/2026-05-20-domain-terminology-audit.md) — vocabulary converged into `CONTEXT.md` + `docs/reference/lexicon.md`; application staged in `plans/2026-07-06-terminology-sweep.md`.
- [Commit message conventions](investigations/2026-05-20-commit-message-conventions.md)
- [Source structure around product verticals](investigations/2026-06-28-source-structure-product-verticals.md) — direction accepted in ADR 0010; execution staged via a follow-up plan.
- [Localising criterion-kind behavior and persistence](investigations/2026-07-16-criterion-kind-ownership-and-persistence.md) — direction accepted in ADR 0013 (criterion-kind vertical modules); execution staged in `plans/2026-07-16-criterion-kind-vertical-modules.md`.
- [Enforcing cross-grid integrity on `criterion_grade`](investigations/2026-07-22-cross-grid-integrity-enforcement.md) — resolved: Option A (composite FKs + replicated `grid_row_id`) accepted in ADR 0015; executed via `plans/2026-07-22-cross-grid-integrity-enforcement.md`.

## ADRs

Short records of durable architecture decisions.

- [0001 Centralise project slug canonicalisation](adr/0001-centralise-slug-canonicalisation.md) (superseded by ADR 0005)
- [0002 `src/db` is infrastructure; features own persistence](adr/0002-db-is-infrastructure-features-own-persistence.md)
- [0003 Node subpath imports with mandatory `.ts` extensions](adr/0003-node-subpath-imports-and-ts-extensions.md)
- [0004 Avoid barrel files](adr/0004-avoid-barrel-files.md)
- [0005 Correct cosmetic project slugs client-side](adr/0005-client-side-cosmetic-slug-correction.md)
- [0006 Prefer flat module structure](adr/0006-prefer-flat-module-structure.md) (superseded by ADR 0010)
- [0007 DB primitives take a handle; wrappers own transactions and cache](adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md)
- [0008 Cache tags, lifetimes, and invalidation](adr/0008-cache-tags-lifetimes-and-invalidation.md)
- [0009 Server-side logging with pino](adr/0009-server-side-logging-with-pino.md)
- [0010 Organize `src/` as enforced vertical layers](adr/0010-organize-src-as-enforced-vertical-layers.md) (supersedes ADR 0006)
- [0011 Adopt Mantine with a constrained, app-owned design system](adr/0011-adopt-mantine-constrained-design-system.md)
- [0012 Converge the domain vocabulary; keep separate internal and user-facing glossaries](adr/0012-converged-domain-vocabulary-and-two-glossaries.md)
- [0013 Organise each criterion kind as a vertical module under `src/criteria`](adr/0013-criterion-kind-vertical-modules.md)
- [0014 A grade target is a set of students; individual vs group is presentation-only](adr/0014-unify-grade-targets-as-student-sets.md)
- [0015 Enforce cross-grid integrity with composite foreign keys](adr/0015-enforce-cross-grid-integrity-with-composite-foreign-keys.md)
- Add new ADRs under `docs/adr/`.

## Designs

Implementation plans for a chosen approach.

- [Import parse, prepare, and write seams](design/2026-06-10-import-parse-prepare-write-seams.md)
- Add new design docs under `docs/design/`.

## Reference

Durable facts about current system behavior, formats, and contracts.

- [Cache invalidation map](reference/cache-invalidation-map.md)
- [Database migrations](reference/database-migrations.md)
- [Testing conventions](reference/testing-conventions.md)
- [Lexicon: user-facing vocabulary](reference/lexicon.md)
- [URL conventions](reference/url-conventions.md)
- Add new reference docs under `docs/reference/`.

## Guides

Procedural how-to documentation for humans.

- [Commit message conventions](guides/commit-message-conventions.md)
- [Documentation conventions](guides/documentation-conventions.md)
- [Issue and PR conventions](guides/issue-and-pr-conventions.md)
- [Next.js caching in this repository](guides/nextjs-caching.md)
- [Running integration tests](guides/running-integration-tests.md)
- Add new guides under `docs/guides/`.

## Plans

Temporary work artifacts for agent-assisted implementation, under `plans/`. Plans never move between directories — a plan's `Status` field is the single source of lifecycle truth, so links to a plan's path stay valid for its entire life.

- [plans/index.md](../plans/index.md) lists every plan with `Status: Active`. Remove a plan's entry there (don't move the file) when it completes.
- Set `Status: Completed` (and remove the `plans/index.md` entry) in the same PR that lands the work — before that PR merges, not after. Updating the plan post-merge means a second PR just to flip one field.
- Completed and abandoned plans are not indexed; find them via `plans/`, git history, or the issue/PR they cite.
- If a proposed plan is not actively being executed, prefer `docs/investigations/` until a concrete implementation plan is needed.
- Stage identifiers (`PR4b`, `stage 2b`) are plan-internal. Use them freely inside the plan; keep them out of commit and pull request titles, which outlive the plan — see [avoid plan-local references](guides/commit-message-conventions.md#avoid-plan-local-references).

Canonical plan metadata block, immediately below the title:

```md
- **Status:** Active | Completed | Abandoned
- **Created:** YYYY-MM-DD
- **Origin:** <investigation, design, ADR, risk ID, or parent plan this work comes from — optional>
- **Tracked by:** <issue — optional>
- **Implemented by:** <PR(s), branch, or commit — optional>
```

Only `Status` and `Created` are required. Use a substantive prose paragraph below the metadata (not a `Resolution`/`Follow-up` field) for anything that needs more than a one-line reference.

## Notes

- Keep investigations in `docs/investigations/` until a decision is durable enough for an ADR.
- Prefer the smallest document type that captures the needed context.
- The [investigation overlap audit](investigations/2026-05-25-investigation-overlap-audit.md) is completed; it's a historical ownership map from the #115/#117 sequencing period, not an actively maintained routing document. For a topic spanning multiple current investigations, check each investigation's own status and "Related" issues directly.
