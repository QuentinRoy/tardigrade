# Converge the domain vocabulary; keep separate internal and user-facing glossaries

- **Status:** Accepted
- **Created:** 2026-07-07
- **Tracked by:** [#99](https://github.com/QuentinRoy/grading/issues/99)
- **Implemented by:** [the terminology sweep plan](../../plans/2026-07-06-terminology-sweep.md)

Settle the project's domain and user-facing terminology, and record it in **two** canonical glossaries that are allowed to diverge:

- **[`CONTEXT.md`](../../CONTEXT.md)** — the internal domain language, precise, for code, contributors, and agents.
- **[`docs/reference/lexicon.md`](../reference/lexicon.md)** — the user-facing dictionary: one preferred word per concept, plain language, alphabetical.

The definitions live in those files; this ADR records *that* the vocabulary was converged, the split between the two glossaries, and why — so a future reader doesn't relitigate settled names or wonder why there are two glossaries.

## Context

Names accreted while the app was a personal tool, and several were overloaded or misleading: `Project` implied a 1:1 map to one real-world test (it doesn't — a test may be split across containers); `Rubric` named a single graded item while every comparable platform uses it for the whole grid; `Submission` named the entity being graded, not submitted work; `assessment` and `grade` were used interchangeably; `ordinal` implied an order the schema never stores. The identifier and model work in [#51](https://github.com/QuentinRoy/grading/issues/51) and [#136](https://github.com/QuentinRoy/grading/issues/136) needs unambiguous names to build on. [#99](https://github.com/QuentinRoy/grading/issues/99) tracked the convergence.

## Decision

**Two glossaries, deliberately distinct audiences.** `CONTEXT.md` optimizes for precision (the word used in code and discussion); the lexicon optimizes for approachability (the word a user sees). They may differ; when they do, `CONTEXT.md` records the mapping, since its readers are the ones who need it. Some internal terms are marked never-user-facing (e.g. **Grade Target**, **Grade Matrix**): the UI names the concrete thing (Student/Group, "Grades") instead.

**The converged vocabulary** (definitions in the glossaries):

- Structure: **Grid** (was Project), **Rubric** (was Question), **Criterion** (was the leaf Rubric), **Student**, **Group** (was Team), **Grade Target** (the graded row — code-only; UI says the Student or Group).
- Values: **Grade** (the recorded per-criterion judgment, and the act — absorbs "assessment"), **Mark** (what a grade is worth), **Value** (a Number criterion's entered number — was "score"), **Total** (the aggregate), **Completion**.
- Criterion **kinds**: **Check** / **Options** / **Number** (were boolean/ordinal/numerical). **`kind`** is the single classifier word (never "type"), matching the grade row's `kind`.
- App public name: **Tardigrade** ([#106](https://github.com/QuentinRoy/grading/issues/106)) — brand, not a domain term, so it lives in neither glossary.

**One vocabulary end-to-end** (DB, code, YAML, UI) for these renames — no internal/external identifier split — except the deliberately non-user-facing terms above.

## Considered options

- **Keep the current names.** Rejected: the overloads actively mislead, and the identifier/model work needs unambiguous names.
- **One combined glossary.** Rejected: it forces one word to serve both the precise-internal and the friendly-user audience. The split lets `Grid` be exact internally while the UI can still say whatever reads best, and makes divergences deliberate and visible rather than accidental.
- **Points** (not Mark), **score → grade** collapse, **Scale/Rating** (not Options), **type** (not kind), **participant** (not Student), **Assignment/Activity** (not Grid). Each rejected for reasons recorded in the glossaries and #99 — mostly: the rejected word smuggles in a meaning the model doesn't guarantee, or isn't the word users actually reach for.

## Consequences

- The terms are **decided but not yet applied in code**. The [sweep plan](../../plans/2026-07-06-terminology-sweep.md) does that, staged leaf-inward with a new migration per schema rename; #99 closes when it lands.
- The three terminology investigations are updated: the [terminology audit](../investigations/2026-05-20-domain-terminology-audit.md) is Completed; the [assessment-target-model](../investigations/2026-05-20-assessment-target-model.md) and [mark-grade-weighting](../investigations/2026-05-20-mark-grade-weighting-model.md) investigations stay open for their **structural** questions (Student/Group unification, the aggregation model) — this ADR settles vocabulary, not model shape.
- A [`lexicon` skill](../../.agents/skills/lexicon/SKILL.md) plus `AGENTS.md` routing keep agents applying the user-facing words; the lexicon is a dictionary only (word → definition), so contracts built from the words (URL tree, CSV columns) are documented with the features that own them.
