# Documentation conventions

How this repository writes and maintains durable documentation: the document types, their templates, the metadata they carry, and how each one is born, lives, and retires. It is the *how-to + rationale* companion to [docs/index.md](../index.md), which is the *map* (where each document lives and what's current).

Scope: this guide owns the conventions for documents under `docs/` (ADRs, investigations, designs, reference, guides) plus the cross-cutting rules (principles, metadata, naming). It does **not** restate the rules for agent-instruction files or plans — those have their own canonical homes and are linked from [Agents and plans](#agents-and-plans-linked-not-owned-here).

## Principles for agent-friendly documentation

This project is maintained by one person working heavily with coding agents. Agents are sensitive to context quality: too little causes wrong changes, too much wastes tokens and injects stale assumptions. These eight principles are the spine of everything below.

1. **Progressive disclosure.** One short always-loaded file (`AGENTS.md`) routes to a map (`docs/index.md`), which routes to focused docs loaded on demand. An agent should answer "where do I look for X?" in one hop and load only X.
2. **Explicit type and lifecycle.** Every non-trivial document declares its type (by folder) and its status near the top. An agent treats `Status: Accepted` very differently from `Status: Active` — but only if it's stated.
3. **A routing table beats a flat list.** Agents do better with "for topic X, read doc Y" than with a pile of links. `AGENTS.md` carries an explicit routing table for this.
4. **Instruction precedence.** When sources disagree, an agent can't arbitrate without a stated order. `AGENTS.md` defines one; investigations and active plans guide work but never override accepted decisions.
5. **Document *why*, not *what*; generate the *what*.** Hand-written docs capture intent, constraints, and trade-offs. Mechanical facts (route lists, table lists, command lists) should be generated or linked to their source of truth, because duplicated facts drift and agents over-trust them.
6. **Tie durable decisions to a source of truth.** A decision is most trustworthy when an agent can check it against code, tests, or an ADR. Link the implementation/test that enforces it.
7. **Defend against staleness.** Status + `Created` metadata, date-prefixed filenames for time-bound docs, explicit supersede pointers, and a bias toward removing stale artifacts rather than letting them linger. Stale docs are worse than missing docs.
8. **One canonical home per fact.** Never duplicate substantial guidance across files; pick one owner and link to it. Duplication across `AGENTS.md`, tool-specific files, and `README.md` was a real drift source here (see the [agent instruction architecture audit](../investigations/2026-05-26-agent-instruction-architecture-audit.md)).

## When to create which document

A document type is produced only when it earns its keep:

```txt
Issue
  -> investigation, if the question is open-ended
  -> ADR, if a significant decision is made
  -> design doc, if implementation details need to be stabilised
  -> plan, if code changes need to be coordinated
  -> PR
```

Not every issue needs every artifact. Use the smallest one that captures the missing context. [docs/index.md](../index.md) is the map of what currently exists.

## Metadata

Every ADR, investigation, design, and plan carries a metadata block as a **Markdown list, immediately below the H1 title**. (Guides and reference docs are living canonical documents — they carry no lifecycle metadata, since they are current by definition; if one is ever retired, mark it `Superseded` with a pointer.) The list form matters: consecutive plain lines collapse into one paragraph on GitHub, so a list is the only form that renders each field on its own line.

```md
# Title

- **Status:** <one value from the type's vocabulary>
- **Created:** YYYY-MM-DD
- ...optional per-type fields...
```

Rules:

- **`Status` and `Created` are required** on every type (ADRs included — `Created` is the decision's date and never moves). Other fields are optional.
- **No `Last updated` field and no changelog.** Git is the edit history for docs-as-code; a hand-maintained "last updated" is just `git log -1` restated, and it goes stale the moment someone forgets to bump it. Keep only metadata git can't express: `Status`, `Created`, and the semantic outcome fields below. The one case where "what changed and why" matters — a decision changing — is handled by ADR supersession (a new ADR, old one marked `Superseded`), not by editing.
- Cross-references (`Related`, `Origin`, `Superseded by`, …) use normal Markdown links or `#issue` / `PR #n` / `ADR 000X` references.

Per-type field sets:

| Type | Required | Optional |
| --- | --- | --- |
| **ADR** | `Status`, `Created` | `Supersedes` / `Superseded by`, `Related` |
| **Investigation** | `Status`, `Created` | `Related`, `Resolution` (when concluded), `Follow-up` |
| **Design** | `Status`, `Created` | `Related`, `Resolution` |
| **Plan** | `Status`, `Created` | `Origin`, `Tracked by`, `Implemented by` — defined at [docs/index.md#plans](../index.md#plans) |

## Status vocabulary

Each type has its own vocabulary. This table is the single definition home; templates list the allowed values, `docs/index.md` links here.

| Type | Values |
| --- | --- |
| **ADR** | **Proposed** — drafted, not yet adopted · **Accepted** — in force · **Superseded** — replaced by a newer ADR (see `Superseded by`) · **Deprecated** — no longer recommended, no direct replacement · **Rejected** — considered and declined |
| **Investigation** | **Active** — open question, under investigation · **Completed** — concluded; findings still stand (see `Resolution`) · **Superseded** — a newer document of the same kind has taken over (see [Lifecycle](#lifecycle-how-documents-retire)) · **Abandoned** — dropped without a useful conclusion |
| **Design** | **Draft** — early, incomplete · **Proposed** — complete, awaiting acceptance · **Accepted** — agreed, not yet built · **Implemented** — built · **Superseded** — replaced |
| **Plan** | **Active** — in flight, listed in `plans/index.md` · **Completed** — work landed · **Abandoned** — dropped (reason in prose) |

## Lifecycle: how documents retire

A finished document is in one of two situations, and they get different treatment:

- **Completed** — it concluded and its content still stands as the record. It may have *produced* an ADR/design/plan, but nothing replaced it. **Keep it whole** (it's the rationale those successors point back to) and keep it listed.
- **Superseded** — a newer document *of the same kind* now owns its content. Set `Status: Superseded` with a `Superseded by:` pointer, **remove it from the `docs/index.md` listing** (the successor is what's listed), and then either:
  - **delete it** and repoint inbound links to the successor; or
  - leave a **tombstone** — a ~6-line stub (title, `Status: Superseded`, `Superseded by:`, one sentence of provenance) — when inbound links exist, especially links inside frozen historical docs you shouldn't rewrite. A tombstone catches those links instead of 404-ing.

Do **not** leave a half-gutted document with some rules still in it: that duplicates the successor and misleads. It's keep-whole (Completed) or redirect/delete (Superseded), never a husk.

**Abandoned** documents (dropped mid-flight) are deleted, or reduced to a one-line tombstone if something links to them.

## Document types

### ADR (`docs/adr/`)

Architecture Decision Record: one significant decision, why it was made, the alternatives, and the consequences. Short — not a design doc, not an investigation.

- **Good topics:** centralise slug canonicalisation; `src/db` is infrastructure; avoid barrel files; prefer flat module structure; cache tags/lifetimes/invalidation. **Bad topics:** typos, variable renames, a loading spinner, one-off refactors.
- **Filename:** stable numeric prefix, never renumbered — `docs/adr/0004-avoid-barrel-files.md`. The number lives in the filename, so the **H1 is a descriptive sentence**, not `ADR 000X: …`.
- **Changing a decision:** write a new ADR and mark the old one `Superseded` with a `Superseded by:` line; the supersede chain is the decision's history. Don't rewrite an accepted ADR.

```md
# Avoid barrel files; import from the module that owns the implementation

- **Status:** Accepted
- **Created:** 2026-06-01

## Context
What forces this decision?

## Decision
What are we deciding?

## Alternatives considered
- Option A — why not
- Option B — why not

## Consequences
Positive / negative trade-offs that follow.
```

Prefer the concise Nygard shape for a small project; reach for a heavier MADR-style template only when a decision has many constraints or stakeholders (see [References](#references)).

### Investigation (`docs/investigations/`)

Explore an open technical or product question; compare options; document trade-offs; make a recommendation **without pretending a final decision has been made**. Can be long, but must be skimmable. Date-prefixed (`YYYY-MM-DD-topic.md`).

```md
# Investigation: Topic

- **Status:** Active
- **Created:** YYYY-MM-DD
- **Related:** #issue, PR #n

## Question
What are we trying to learn?

## Executive summary
The short answer.

## Options considered
### Option A — pros / cons
### Option B — pros / cons

## Recommendation
What seems best for now.

## Open questions
- ...
```

When it concludes, set `Status: Completed` and add a `Resolution:` line. If it later produces an ADR, the ADR records the decision while the investigation stays as the rationale (still `Completed`, not `Superseded`).

### Design (`docs/design/`)

How an accepted or likely approach will be implemented — interfaces, data flow, failure modes, rollout, testing — with enough detail for one or more implementation PRs. More concrete than an investigation, less permanent than an ADR. Date-prefix it when tied to a specific implementation effort.

```md
# Design: Feature or subsystem

- **Status:** Proposed
- **Created:** YYYY-MM-DD
- **Related:** #issue, ADR 000X

## Goal
## Constraints
## Proposed design
## Data model
## API / interface
## Failure modes
## Testing strategy
## Open questions
```

### Reference (`docs/reference/`)

Durable facts about the current system — lookup material so agents don't infer stable contracts from scattered code. Examples: testing conventions, database migrations, the cache-invalidation map; candidates include the YAML grading format, env vars, public URL conventions, import/export formats. Not date-prefixed. Keep it close to the code it describes, and if it would duplicate generated information, generate it or link to the source instead (principle 5).

### Guide (`docs/guides/`)

Durable how-to and conventions for performing a task in this repo — read by whoever does the task, human or agent (this document is one). Examples: commit-message conventions, issue and PR conventions, running integration tests. Not date-prefixed. Procedural and concise.

**Guide vs skill.** The dividing line is *activation*, not audience (agents read guides too). Agent-applied **coding conventions live as skills** under `.agents/skills/` — a uniform home for what to apply while writing code. What varies is how a skill gets *loaded*: a cleanly domain-scoped convention (component styling, user-facing error handling, test fixtures) leans on its description to *auto-trigger* when that work comes up; a near-universal one (general code style, TypeScript API shape in a TS-only repo) can't rely on auto-triggering — skills tend to under-trigger — so `AGENTS.md` names it explicitly ("when writing TypeScript, consult …"), the same way it always loads the `caveman` skill. Either way the convention's *body* stays out of context until it's loaded, and `AGENTS.md` holds the pointer, not the rules. Reserve `docs/guides/` for human/process workflows (commits, PRs, running tests) and durable explanations. Mechanically-checkable rules go further still — into lint, where they're enforced rather than remembered. Reserve `docs/guides/` for those durable explanations and for human/process workflows. (Routing the conditional conventions into skills is tracked in `plans/2026-06-23-agent-instruction-layer-hardening.md`.)

> The `adr` / `design` / `reference` / `guides` split maps onto the [Diátaxis](https://diataxis.fr/) quadrants (explanation / — / reference / how-to). When unsure which folder fits, ask whether the reader wants to *understand*, *do*, or *look up*.

### README

`README.md` is human onboarding: what the project is, how to install/run/test it, common commands, required env vars, and a link to [docs/index.md](../index.md). Keep it navigational — deep audits and active plans do not belong there.

## Naming conventions

Names encode purpose and time-boundedness.

- **Date-prefix time-bound docs** — investigations, effort-tied designs, plans: `YYYY-MM-DD-topic.md`.
- **Don't date-prefix stable canonical docs** — guides and reference docs.
- **ADRs use a numeric prefix**, not a date.
- Descriptive kebab-case throughout. Avoid `notes.md`, `architecture.md`, `final.md`, `final-v2.md`.

## What to document

Document things that are: hard to infer from code; likely to be revisited; architecturally significant; safety-critical; useful to an agent *before* it makes changes; tied to important trade-offs; relevant across multiple PRs. (E.g. why project URLs use stable IDs plus cosmetic slugs; why grading data must never be silently lost.)

Do **not** document things that are obvious from code, duplicated from `package.json` or tests, volatile, better generated, or specific to one trivial PR.

**Generate, don't hand-write, mechanical facts** — route lists, table lists derivable from migrations/schema, API schemas from typed validators, command lists from `package.json`. Anything mechanically checkable (a link, a path, a command) should ideally be checked in CI, so drift fails loudly instead of misleading an agent silently.

## How documents relate to issues and PRs

```txt
Issue
  -> investigation   (what was considered)
  -> ADR             (what was decided)
  -> design doc      (how it will work)
  -> plan            (how the work will be done)
  -> PR              (what changed)
```

## Failure modes to avoid

- **Treating an investigation as a decision.** Keep it in `docs/investigations/` with an explicit `Status`; extract an ADR when a decision is actually made.
- **Letting an implemented doc masquerade as current guidance.** Once superseded, redirect or delete it (see [Lifecycle](#lifecycle-how-documents-retire)); don't leave executed work reading like open TODOs.
- **Turning `AGENTS.md` into a knowledge dump.** Keep it minimal and navigational; link to docs instead of embedding them.
- **Duplicating source-of-truth information.** Document *why*; generate *what*; keep reference docs next to the code they describe.
- **Creating too many ADRs.** Only decisions with durable consequences; use plans or PR descriptions for small choices.
- **Mixing public user docs with internal development docs.** Human procedures in `docs/guides/`; development knowledge in `docs/investigations/` / `docs/design/` / `docs/adr/`.

## Agents and plans (linked, not owned here)

These have their own canonical homes; this guide does not restate their rules.

- **Agent-instruction files** (`AGENTS.md`, and the thin tool-specific pointers `CLAUDE.md` / `.github/copilot-instructions.md`): see [AGENTS.md](../../AGENTS.md) for the live rules and the [agent instruction architecture audit](../investigations/2026-05-26-agent-instruction-architecture-audit.md) for why it's structured that way. The short version: one canonical `AGENTS.md`; tool-specific files only point to it; keep the always-loaded surface to operate + route + precedence + safety.
- **Plans** (`plans/`): see [docs/index.md#plans](../index.md#plans) for the metadata block and lifecycle. The short version: one flat directory, lifecycle tracked by `Status`, `plans/index.md` lists active ones, set `Status: Completed` in the PR that lands the work.
- **Domain language:** [CONTEXT.md](../../CONTEXT.md) is the glossary — read it before touching domain terms, identifiers, or contracts.

## References

- Michael Nygard, "Documenting Architecture Decisions": <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions> — the concise ADR style this repo prefers.
- MADR: <https://adr.github.io/madr/> — the heavier template for high-constraint decisions.
- Diátaxis: <https://diataxis.fr/> — the understand/do/look-up split behind the folder types.
- AGENTS.md: <https://agents.md/> — the cross-tool context-file convention.
- "One Size Fits All? An Empirical Comparison of ADR Templates" (2026): <https://arxiv.org/abs/2604.27333> — Nygard scored well on comprehension and adoption vs MADR.
- "Configuring Agentic AI Coding Tools: An Exploratory Study" (2026): <https://arxiv.org/abs/2602.14690> — context files are the dominant configuration approach; `AGENTS.md` is emerging as a cross-tool standard.
- "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?" (2026): <https://arxiv.org/abs/2602.11988> — non-essential context can reduce task success and raise cost.
- "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents" (2026): <https://arxiv.org/abs/2601.20404> — `AGENTS.md` associated with lower runtime and output-token use at similar completion rates.
