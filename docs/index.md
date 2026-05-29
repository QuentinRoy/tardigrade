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

- [Grading workflows and product positioning](investigations/grading-workflows-and-product-positioning.md)
- [Domain terminology audit](investigations/domain-terminology-audit.md)
- [Assessment target model](investigations/assessment-target-model.md)
- [Mark, grade and weighting model](investigations/mark-grade-weighting-model.md)

### Technical architecture investigations

- [Source structure and technical debt audit](investigations/source-structure-and-tech-debt-audit.md)
- [Investigation overlap audit](investigations/investigation-overlap-audit.md)
- [Read-write separation and schema-change resilience](investigations/read-write-separation-and-schema-change-resilience.md)
- [Offline support and local assessment storage](investigations/offline-support.md)
- [Repository documentation architecture](investigations/repository-documentation-architecture.md)
- [Agent instruction architecture audit](investigations/2026-05-26-agent-instruction-architecture-audit.md)

### Workflow convention investigations

- [Commit message conventions](investigations/commit-message-conventions.md)

## ADRs

Short records of durable architecture decisions.

- Add new ADRs under `docs/adr/`.

## Designs

Implementation plans for a chosen approach.

- Add new design docs under `docs/design/`.

## Reference

Durable facts about current system behavior, formats, and contracts.

- [Database migrations](reference/database-migrations.md)
- [Testing conventions](reference/testing-conventions.md)
- Add new reference docs under `docs/reference/`.

## Guides

Procedural how-to documentation for humans.

- [Issue and PR conventions](guides/issue-and-pr-conventions.md)
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
- Use the [investigation overlap audit](investigations/investigation-overlap-audit.md) when a topic appears to span multiple current investigations or planning artifacts.