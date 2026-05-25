# Documentation index

This repository keeps docs small and purpose-built. Use this page to find the right document type quickly.

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
- [Offline support and local assessment storage](investigations/offline-support.md)
- [Repository documentation architecture](investigations/repo-documentation-architecture.md)
- [Agent instruction architecture audit](investigations/agent-instruction-architecture-audit.md)

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

- [Running integration tests](guides/running-integration-tests.md)
- Add new guides under `docs/guides/`.

## Execution plans

Temporary work artifacts for agent-assisted implementation.

- Active plans live in `plans/active/`.
- Completed plans move to `plans/completed/`.

## Notes

- Keep investigations in `docs/investigations/` until a decision is durable enough for an ADR.
- Prefer the smallest document type that captures the needed context.
- Use the [investigation overlap audit](investigations/investigation-overlap-audit.md) when a topic appears to span multiple current investigations.
