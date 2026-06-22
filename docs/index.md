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
- Temporary execution plans belong in `plans/active/` until completed.

## Document lifecycle

Use date-prefixed filenames for time-bound documents:

- `docs/investigations/YYYY-MM-DD-topic.md`
- `docs/design/YYYY-MM-DD-topic.md` when the design is tied to a specific implementation effort
- `plans/active/YYYY-MM-DD-topic.md`
- `plans/completed/YYYY-MM-DD-topic.md`

Do not date-prefix stable canonical documents by default, such as guides, reference docs, and ADRs.

Time-bound documents should include lifecycle metadata near the top:

- `Status: Active | Completed | Superseded | Archived`
- `Date: YYYY-MM-DD`
- `Resolution: ...`
- `Follow-up: None | ...`

## Investigations

Open-ended audits and option analysis. Investigations may contain hypotheses and candidate directions; they are not accepted decisions unless later captured in an ADR or implemented in code/tests.

### Product and domain investigations

- [Grading workflows and product positioning](investigations/2026-05-22-grading-workflows-and-product-positioning.md)
- [Domain terminology audit](investigations/2026-05-20-domain-terminology-audit.md)
- [Assessment target model](investigations/2026-05-20-assessment-target-model.md)
- [Mark, grade and weighting model](investigations/2026-05-20-mark-grade-weighting-model.md)

### Technical architecture investigations

- [Read-write separation and schema-change resilience](investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md) — largely implemented; only R-008 (rubric overview analytics) remains open.
- [Offline support and local assessment storage](investigations/2026-05-19-offline-support.md)
- [Repository documentation architecture](investigations/2026-05-19-repo-documentation-architecture.md)

### Completed investigations

- [Source structure and technical debt audit](investigations/2026-05-25-source-structure-and-tech-debt-audit.md) — all 8 prioritized backlog items Done; remaining narrow items deferred to #136 or intentionally deprioritized.
- [Caching and loading audit](investigations/2026-06-11-caching-loading-audit.md) — resolved; all 13 planned PRs landed, #59 closed.
- [Investigation overlap audit](investigations/2026-05-25-investigation-overlap-audit.md) — coordinated #115/#117 sequencing; all related issues are now closed.
- [Agent instruction architecture audit](investigations/2026-05-26-agent-instruction-architecture-audit.md)
- [Commit message conventions](investigations/2026-05-20-commit-message-conventions.md)

## ADRs

Short records of durable architecture decisions.

- [0001 Centralise project slug canonicalisation](adr/0001-centralise-slug-canonicalisation.md) (superseded by ADR 0005)
- [0002 `src/db` is infrastructure; features own persistence](adr/0002-db-is-infrastructure-features-own-persistence.md)
- [0003 Node subpath imports with mandatory `.ts` extensions](adr/0003-node-subpath-imports-and-ts-extensions.md)
- [0004 Avoid barrel files](adr/0004-avoid-barrel-files.md)
- [0005 Correct cosmetic project slugs client-side](adr/0005-client-side-cosmetic-slug-correction.md)
- [0006 Prefer flat module structure](adr/0006-prefer-flat-module-structure.md)
- [0007 DB primitives take a handle; wrappers own transactions and cache](adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md)
- [0008 Cache tags, lifetimes, and invalidation](adr/0008-cache-tags-lifetimes-and-invalidation.md)
- [0009 Server-side logging with pino](adr/0009-server-side-logging-with-pino.md)
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
- Add new reference docs under `docs/reference/`.

## Guides

Procedural how-to documentation for humans.

- [Commit message conventions](guides/commit-message-conventions.md)
- [Issue and PR conventions](guides/issue-and-pr-conventions.md)
- [Next.js caching in this repository](guides/nextjs-caching.md)
- [Running integration tests](guides/running-integration-tests.md)
- [TypeScript API design](guides/typescript-api-design.md)
- Add new guides under `docs/guides/`.

## Execution plans

Temporary work artifacts for agent-assisted implementation.

- Active plans live in `plans/active/`.
- Completed plans move to `plans/completed/`.
- If a proposed plan is not actively being executed, prefer `docs/investigations/` until a concrete implementation plan is needed.

## Notes

- Keep investigations in `docs/investigations/` until a decision is durable enough for an ADR.
- Prefer the smallest document type that captures the needed context.
- The [investigation overlap audit](investigations/2026-05-25-investigation-overlap-audit.md) is completed; it's a historical ownership map from the #115/#117 sequencing period, not an actively maintained routing document. For a topic spanning multiple current investigations, check each investigation's own status and "Related" issues directly.
