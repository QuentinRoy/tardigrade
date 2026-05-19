# Investigation: repository documentation architecture

Status: Current investigation
Date: 2026-05-19
Related: repository documentation conventions, agent workflows, plans, ADRs

## Question

How should this repository organize technical documentation, architecture notes, investigations, and implementation plans so that they remain useful for a solo developer working heavily with coding agents?

The goal is not to create a large documentation bureaucracy. The goal is to make the repository easier to maintain, easier for agents to navigate, and safer to change.

## Executive summary

Use docs-as-code, but separate documents by purpose.

Recommended structure:

```txt
README.md
AGENTS.md

docs/
  index.md
  adr/
  investigations/
  design/
  reference/
  guides/

plans/
  active/
  completed/
```

Recommended rule of thumb:

- `README.md` is for project onboarding.
- `AGENTS.md` is for short operational instructions to coding agents.
- `docs/adr/` records accepted or proposed architectural decisions.
- `docs/investigations/` stores audits, comparisons, and open-ended technical exploration.
- `docs/design/` describes a chosen design before or during implementation.
- `docs/reference/` describes durable facts about the current system.
- `docs/guides/` contains human-oriented how-to documentation.
- `plans/active/` contains temporary execution plans for implementation work.
- `plans/completed/` optionally archives plans after the work is done.

The most important principle is that each document should have a clear type, lifecycle, and status.

## Why this matters for this repository

This project is currently developed by a solo maintainer, but with heavy use of coding agents. That changes the documentation problem.

The docs need to help:

- the maintainer recover context after interruptions;
- agents understand project conventions without reading the whole repository;
- future PRs link design intent to implementation;
- architectural decisions survive refactors;
- temporary plans remain separate from durable documentation;
- stale exploratory notes do not get mistaken for accepted decisions.

Agents are useful, but they are sensitive to context quality. Too little context causes incorrect changes. Too much context causes irrelevant constraints, token waste, and stale assumptions. Documentation should therefore be structured so agents can read only the relevant artifacts.

## Main recommendation

Adopt a small docs-as-code structure with explicit document categories.

```txt
docs/
  index.md
  adr/
  investigations/
  design/
  reference/
  guides/

plans/
  active/
  completed/
```

This should be treated as a lightweight convention, not as a rigid process.

A good workflow is:

```txt
Issue
  -> investigation, if the question is open-ended
  -> ADR, if a significant decision is made
  -> design doc, if implementation details need to be stabilized
  -> plan, if code changes need to be coordinated
  -> PR
```

Not every issue needs every artifact.

## Document types

### README

Path:

```txt
README.md
```

Purpose:

- help a new human understand what the project is;
- explain how to install, run, test, and use the app;
- link to deeper docs.

Good README content:

- project purpose;
- quick start;
- common commands;
- required environment variables;
- link to `docs/index.md`;
- development notes that are stable and short.

Avoid putting deep architecture audits or active plans in the README. The README should stay navigational and onboarding-oriented.

### Documentation index

Path:

```txt
docs/index.md
```

Purpose:

- provide a map of the documentation set;
- help humans and agents find the right document quickly;
- reduce the temptation to read every Markdown file.

Recommended content:

```md
# Documentation index

## Architecture decisions

See `docs/adr/`.

## Investigations

- `docs/investigations/offline-grading-mode.md`: options for optional offline grading support.
- `docs/investigations/repo-documentation-architecture.md`: documentation architecture and agent workflow conventions.

## Designs

Design documents for chosen implementation approaches.

## Reference

Durable descriptions of current formats, APIs, and data models.
```

### ADRs

Path:

```txt
docs/adr/
```

ADR means Architecture Decision Record.

Purpose:

- record a significant decision;
- explain why it was made;
- list alternatives considered;
- preserve consequences and trade-offs.

ADRs should be short. They are not design docs and not investigations.

Good ADR topics:

- choose Kysely over another database access layer;
- use stable public project IDs plus cosmetic slugs;
- use surrogate student row IDs;
- use IndexedDB/Dexie for an offline assessment outbox;
- choose a client-side search library.

Bad ADR topics:

- fix a typo;
- rename a local variable;
- add a loading spinner;
- refactor one helper;
- document every small PR.

Recommended ADR filename format:

```txt
docs/adr/0001-use-kysely.md
docs/adr/0002-use-stable-project-ids.md
docs/adr/0003-use-indexeddb-outbox-for-offline-grading.md
```

Do not renumber ADRs. If a decision changes, create a new ADR and mark the older one as superseded.

Recommended ADR template:

```md
# ADR 000X: Title

Status: Proposed
Date: YYYY-MM-DD
Related: #issue, PR #number

## Context

What forces this decision?

## Decision

What are we deciding?

## Alternatives considered

- Option A
- Option B
- Option C

## Consequences

Positive:

- ...

Negative:

- ...

## Follow-ups

- ...
```

Suggested statuses:

```txt
Proposed
Accepted
Superseded
Deprecated
Rejected
```

For a small project, prefer the concise Nygard-style ADR structure. Use a more detailed MADR-like structure only when the decision has many constraints or stakeholders.

### Investigations

Path:

```txt
docs/investigations/
```

Purpose:

- explore an open technical or product question;
- compare options;
- document trade-offs;
- make a recommendation without pretending a final decision has been made.

Investigations are appropriate for:

- offline grading support;
- repository documentation architecture;
- authentication/passkey strategy;
- local search options;
- export format options;
- testing strategy audits.

Investigations can be long. They should be well organized and easy to skim.

Recommended filename format:

```txt
docs/investigations/offline-grading-mode.md
docs/investigations/repo-documentation-architecture.md
docs/investigations/local-search-options.md
```

Recommended investigation template:

```md
# Investigation: Topic

Status: Current investigation
Date: YYYY-MM-DD
Related: #issue

## Question

What are we trying to learn?

## Executive summary

What is the short answer?

## Context

Why does this matter?

## Options considered

### Option A

Pros:

- ...

Cons:

- ...

### Option B

Pros:

- ...

Cons:

- ...

## Recommendation

What seems best for now?

## Non-goals

What should not be done yet?

## Open questions

- ...

## References

- ...
```

An investigation can later produce an ADR. For example:

```txt
docs/investigations/offline-grading-mode.md
  -> docs/adr/000X-use-indexeddb-outbox-for-offline-grading.md
```

### Design docs

Path:

```txt
docs/design/
```

Purpose:

- describe how an accepted or likely approach will be implemented;
- define interfaces, data flow, failure modes, rollout, and testing;
- provide enough detail for an implementation PR or a series of PRs.

A design doc is more concrete than an investigation, but less permanent than an ADR.

Good design doc topics:

- offline sync v1;
- import pipeline;
- assessment data model;
- grading export flow;
- authentication flow.

Recommended design doc template:

```md
# Design: Feature or subsystem

Status: Proposed
Date: YYYY-MM-DD
Related: #issue, ADR 000X

## Goal

What should this design enable?

## Constraints

- ...

## Proposed design

## Data model

## API / interface

## UI behavior

## Failure modes

## Testing strategy

## Migration / rollout

## Open questions
```

Suggested statuses:

```txt
Draft
Proposed
Accepted
Implemented
Superseded
```

### Reference docs

Path:

```txt
docs/reference/
```

Purpose:

- describe durable facts about the current system;
- serve as lookup material for humans and agents;
- avoid forcing agents to infer stable contracts from scattered code.

Good reference docs:

- YAML grading format;
- environment variables;
- database schema overview;
- public URL conventions;
- API routes;
- import/export file formats.

Reference docs should be kept close to the code they describe. If a reference doc duplicates generated information, prefer generating it or linking to the source of truth.

Avoid reference docs that constantly drift from implementation.

### Guides

Path:

```txt
docs/guides/
```

Purpose:

- explain how to do a task;
- target humans more than agents;
- provide procedures rather than architectural reasoning.

Good guide topics:

- how to create a grading project;
- how to import Moodle submissions;
- how to run integration tests;
- how to reset the local development database.

Guides should be procedural and concise.

### Plans

Path:

```txt
plans/active/
plans/completed/
```

Purpose:

- coordinate implementation work;
- give agents an explicit checklist;
- make work auditable before code changes;
- avoid mixing temporary execution notes with durable docs.

Plans are not architecture docs. They are working artifacts.

Recommended plan filename format:

```txt
plans/active/issue-63-save-failure-protection.md
plans/active/issue-64-offline-grading-queue.md
plans/completed/issue-17-project-slugs.md
```

Recommended plan template:

```md
# Plan: Title

Status: Active
Date: YYYY-MM-DD
Related: #issue

## Goal

What should be true when this is done?

## Scope

In scope:

- ...

Out of scope:

- ...

## Steps

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Validation

- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Targeted behavior verified

## Notes

- ...
```

Suggested statuses:

```txt
Draft
Active
Blocked
Completed
Abandoned
```

Plans can be deleted or moved to `plans/completed/` when no longer useful. They do not need to remain pristine.

## Agent-specific documentation

### AGENTS.md

Path:

```txt
AGENTS.md
```

Purpose:

- give coding agents short operating rules;
- point them to the documentation map;
- encode repository-specific safety constraints;
- avoid long context dumps.

The file should be short. It should contain instructions that are almost always relevant, not the full architecture of the project.

Recommended content:

```md
# Agent instructions

## Before code changes

Create or update a plan in `plans/active/` unless the user explicitly says otherwise.

## Documentation conventions

- Use `docs/investigations/` for audits and option analysis.
- Use `docs/adr/` for architectural decisions.
- Use `docs/design/` for implementation designs.
- Use `docs/reference/` for durable current-system facts.
- Use `plans/active/` for execution plans.
- Keep ADRs short.

## Validation

Before claiming completion, run the smallest relevant checks:

- typecheck;
- lint/format;
- targeted tests.

## Safety rules

- Do not rewrite committed migrations.
- Do not silently discard grading data.
- Do not mark local-only grading changes as server-synced.
```

### Why keep AGENTS.md short?

Repository-level context files are increasingly common for coding agents, and `AGENTS.md` is emerging as a cross-tool convention. However, the current evidence is mixed. Some studies suggest such files can reduce runtime and output tokens, while others find that unnecessary requirements can reduce task success and increase cost.

The practical implication is:

> Use an agent context file, but keep it minimal, operational, and navigational.

Do not turn `AGENTS.md` into a full architecture manual.

### Tool-specific instruction files

Other tools may support their own files, for example:

```txt
.github/copilot-instructions.md
CLAUDE.md
.cursor/rules/
```

Avoid duplicating substantial instructions across many files. Prefer one canonical `AGENTS.md` and make tool-specific files point to it when possible.

If duplication is unavoidable, keep duplicated content very small.

## How documents should relate to issues and PRs

A useful traceability graph looks like this:

```txt
Issue
  -> investigation
  -> ADR
  -> design doc
  -> plan
  -> PR
```

Example for optional offline grading:

```txt
Issue #64
  -> docs/investigations/offline-grading-mode.md
  -> docs/adr/000X-use-indexeddb-outbox-for-offline-grading.md
  -> docs/design/offline-sync-v1.md
  -> plans/active/issue-64-offline-grading.md
  -> implementation PRs
```

The investigation should say what was considered.
The ADR should say what was decided.
The design doc should say how it will work.
The plan should say how the work will be done.
The PR should say what changed.

## Status metadata

Every non-trivial document should include status metadata near the top.

Recommended fields:

```md
Status: Current investigation
Date: YYYY-MM-DD
Related: #issue, ADR 000X, PR #number
```

Useful statuses by document type:

```txt
Investigation:
  Draft
  Current investigation
  Superseded

ADR:
  Proposed
  Accepted
  Superseded
  Deprecated
  Rejected

Design:
  Draft
  Proposed
  Accepted
  Implemented
  Superseded

Plan:
  Draft
  Active
  Blocked
  Completed
  Abandoned
```

This matters because stale docs are worse than missing docs. Agents are especially likely to over-trust an old document unless its status is explicit.

## Naming conventions

Use names that encode the document's purpose.

Good:

```txt
docs/investigations/offline-grading-mode.md
docs/investigations/repo-documentation-architecture.md
docs/adr/0004-use-dexie-for-offline-assessment-outbox.md
docs/design/offline-sync-v1.md
plans/active/issue-63-save-failure-protection.md
```

Avoid:

```txt
docs/offline.md
docs/architecture.md
docs/notes.md
docs/ideas.md
docs/final.md
docs/final-v2.md
```

For ADRs, use stable numeric prefixes.

For plans, include the issue number when there is one.

For investigations and designs, prefer descriptive kebab-case names.

## What should be documented?

Document things that are:

- hard to infer from code;
- likely to be revisited;
- architecturally significant;
- safety-critical;
- useful to agents before making changes;
- tied to important trade-offs;
- relevant across multiple PRs.

Examples:

- why project URLs use stable IDs and cosmetic slugs;
- why student rows use surrogate keys;
- how grading data must not be silently lost;
- how imports map to internal entities;
- how offline sync should handle conflicts;
- why one validation library or data access layer was chosen.

Do not document things that are:

- obvious from code;
- duplicated from `package.json`;
- duplicated from tests;
- volatile implementation details;
- better generated;
- specific to a single trivial PR.

## What should be generated instead?

Prefer generated or source-of-truth-driven documentation for:

- route lists;
- database table lists, if they can be derived from migrations or schema types;
- API schemas, if generated from typed validators;
- command lists, if already present in `package.json`.

Hand-written docs should explain intent, constraints, and trade-offs. Generated docs should list mechanical facts.

## Recommended initial migration for this repository

A minimal first step:

```txt
README.md
AGENTS.md

docs/
  index.md
  investigations/
    offline-grading-mode.md
    repo-documentation-architecture.md
  adr/
  design/
  reference/
  guides/

plans/
  active/
  completed/
```

Suggested immediate actions:

1. Keep this document under `docs/investigations/repo-documentation-architecture.md`.
2. Move the optional offline grading audit to `docs/investigations/offline-grading-mode.md`.
3. Add `docs/index.md` as a lightweight map once there are several docs.
4. Add `AGENTS.md` with short operational rules.
5. Start using `plans/active/` for agent-executed code changes.
6. Create ADRs only when a decision is accepted or seriously proposed.

Avoid doing a massive documentation reorganization before there is enough material to justify it.

## Recommended workflow for agent-assisted changes

For non-trivial code changes:

```txt
1. Read the issue or user request.
2. Read AGENTS.md.
3. Read docs/index.md if relevant.
4. Read only the relevant ADRs, investigations, or designs.
5. Create or update a plan in plans/active/.
6. Implement the change.
7. Run targeted validation.
8. Update docs only if behavior, architecture, or decisions changed.
9. Link the issue, plan, and docs in the PR body.
```

For documentation-only investigations:

```txt
1. Create a branch.
2. Add or update a file under docs/investigations/.
3. Use explicit status metadata.
4. Link related issues if any.
5. Open a documentation PR.
```

For architectural decisions:

```txt
1. Start with an investigation if the decision is not obvious.
2. Create a short ADR once the decision is made or proposed.
3. Link the ADR from related design docs and PRs.
4. Mark older ADRs superseded instead of rewriting history.
```

## Failure modes to avoid

### Treating investigations as decisions

An investigation may recommend an approach, but it is not the same as an accepted decision.

Mitigation:

- use `docs/investigations/`;
- add `Status: Current investigation`;
- extract an ADR when a decision is made.

### Turning AGENTS.md into a knowledge dump

A long agent instruction file can make agents slower and less accurate.

Mitigation:

- keep `AGENTS.md` short;
- link to docs instead of embedding them;
- include only stable, high-value operating rules.

### Keeping active plans forever

Plans are working artifacts. If every completed checklist remains active, agents may follow outdated tasks.

Mitigation:

- move old plans to `plans/completed/`;
- mark abandoned plans explicitly;
- link completed plans from PRs if useful.

### Duplicating source-of-truth information

Docs that duplicate code drift quickly.

Mitigation:

- document why, not just what;
- generate mechanical references where possible;
- keep reference docs close to source-of-truth files.

### Creating too many ADRs

ADRs lose value if they record every small change.

Mitigation:

- create ADRs only for decisions with durable consequences;
- keep them short;
- use plans or PR descriptions for small implementation choices.

### Mixing public user docs and internal development docs

A user guide and an architecture investigation serve different audiences.

Mitigation:

- use `docs/guides/` for human procedures;
- use `docs/investigations/`, `docs/design/`, and `docs/adr/` for development knowledge.

## Open questions

- Should this repository use `docs/architecture/` at all, or replace it with the more specific `adr/`, `design/`, and `investigations/` categories?
- Should active plans be required for every code change, or only for non-trivial changes?
- Should `plans/completed/` be kept long-term, or should completed plans usually be deleted after merge?
- Should `AGENTS.md` be the only agent instruction file, or should there also be tool-specific files for Copilot, Claude Code, or Cursor?
- Should documentation status be free text or a small controlled vocabulary?
- Should PR templates ask whether docs, ADRs, or plans were updated?

## Recommendation for now

Adopt a lightweight version of the structure:

```txt
docs/investigations/
docs/adr/
docs/design/
docs/reference/
plans/active/
```

Then add two small supporting files when convenient:

```txt
docs/index.md
AGENTS.md
```

Do not force every change through all document types. Use the smallest artifact that captures the missing context.

For the current repository, the most useful immediate conventions are:

1. Put audits and open-ended technical exploration in `docs/investigations/`.
2. Put durable decisions in short ADRs under `docs/adr/`.
3. Put implementation designs in `docs/design/` only once a direction is chosen.
4. Put temporary agent work plans in `plans/active/`.
5. Keep agent instructions minimal and navigational.

## References and further reading

- Michael Nygard, "Documenting Architecture Decisions": https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- MADR project: https://adr.github.io/madr/
- Diataxis documentation framework: https://diataxis.fr/
- GitHub Copilot custom instructions: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot
- AGENTS.md: https://agents.md/
- "One Size Fits All? An Empirical Comparison of ADR Templates regarding Comprehension, Usability, and Ease of Adoption" (2026): https://arxiv.org/abs/2604.27333
- "Configuring Agentic AI Coding Tools: An Exploratory Study" (2026): https://arxiv.org/abs/2602.14690
- "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?" (2026): https://arxiv.org/abs/2602.11988
- "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents" (2026): https://arxiv.org/abs/2601.20404
