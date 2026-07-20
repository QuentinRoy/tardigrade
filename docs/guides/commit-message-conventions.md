# Commit message conventions

Use lightweight area-prefixed commit messages:

```txt
<area>: <imperative summary>
```

Examples:

```txt
db: scope grade saves to grid
ci: skip expensive checks for docs-only changes
docs: add issue template conventions
agents: clarify instruction ownership
ui: fix drawer close behavior on iPad
```

Use this convention for normal commit titles and squash merge titles. Pull request titles should usually follow the same shape when it stays readable.

Do not add commit linting or CI enforcement unless message drift becomes a practical review problem.

## Areas

Choose the main subsystem or intent of the change:

```txt
app
ui
db
migrations
import
export
grading
rubrics
grids
tests
storybook
ci
docs
agents
deps
```

When several areas are touched, choose the main reason for the change rather than listing every touched file.

Prefer:

```txt
db: scope grade saves to grid
```

over:

```txt
db/tests/docs: scope grade saves to grid
```

## Summary style

Use an imperative verb after the prefix:

```txt
add
fix
remove
document
clarify
scope
rename
simplify
harden
```

Prefer lowercase summaries unless a proper noun or code identifier requires capitalization.

Avoid issue numbers as the area:

```txt
# Avoid
test(issue-19): harden reliability for DB constraints
Fix #60: refactor AppShell

# Prefer
db: harden rubric mutation constraints
ui: refactor AppShell drawer behavior
```

Put issue references in the pull request body or commit body instead:

```txt
Fixes #19
Related to #83
```

## Title length

Keep the title under 50 characters, including the area prefix. Treat 72 as a hard ceiling: past that, `git log --oneline`, blame views, and pull request lists truncate the summary.

```txt
# Too long (94)
docs: refresh README, add URL conventions doc, and audit UI copy for terminology sweep stage 9

# Too long (61)
criteria: revise test coverage after vertical-module migration

# Prefer (44)
criteria: revise post-migration test coverage
```

The limit applies to the title as written. GitHub appends `(#123)` to squash merge titles; that suffix does not count against the budget.

A long title is usually a title doing the body's job. Name the single main change, and move the enumeration, the reasoning, and the caveats into the [commit body](#commit-bodies). If no single change can be named because the commit genuinely does several unrelated things, the commit wants splitting rather than a longer title.

## Avoid plan-local references

A title must still make sense in `git log` long after the plan that produced it is completed and forgotten. Plan stage identifiers do not survive that: they name a position in a document nobody is reading anymore.

```txt
# Avoid
criteria: revise test coverage after vertical-module migration (PR4b)
rubrics: Question→Rubric container rename (terminology sweep stage 2b)

# Prefer
criteria: revise test coverage after vertical-module migration
rubrics: rename Question container to Rubric
```

References to durable in-repo documents are fine, because they stay discoverable:

```txt
db: type write primitives as Transaction<DB> (ADR 0007)
```

Put the stage reference in the commit body or the pull request body instead:

```txt
Executes PR4b of plans/2026-07-16-criterion-kind-vertical-modules.md
```

Plan-to-PR traceability belongs in the plan, which records the pull request that landed each stage. The title does not need to carry it.

## Commit bodies

For non-trivial commits, add a body explaining why the change is needed, what approach was taken, and any important validation.

```txt
db: scope grade saves to grid

Rubric and criterion ids are only unique within a grid. Resolve the
rubric through the grade target's grid before resolving the criterion so
grade saves cannot cross grid boundaries when public ids collide.

Validation:
- pnpm run check-types
- pnpm run test:integration
```

## Non-goals

- Do not require full Conventional Commits.
- Do not add `commitlint`.
- Do not enforce commit messages in CI unless the convention starts to drift enough to cause real review friction.
- Do not maintain a strict area registry unless loose consistency stops being enough.