# Commit message conventions

Use lightweight area-prefixed commit messages:

```txt
<area>: <imperative summary>
```

Examples:

```txt
db: scope assessment saves to project
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
assessments
questions
rubrics
projects
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
db: scope assessment saves to project
```

over:

```txt
db/tests/docs: scope assessment saves to project
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
db: harden question mutation constraints
ui: refactor AppShell drawer behavior
```

Put issue references in the pull request body or commit body instead:

```txt
Fixes #19
Related to #83
```

## Commit bodies

For non-trivial commits, add a body explaining why the change is needed, what approach was taken, and any important validation.

```txt
db: scope assessment saves to project

Question and rubric ids are only unique within a project. Resolve the
question through the submission project before resolving the rubric so
assessment saves cannot cross project boundaries when public ids collide.

Validation:
- pnpm run check-types
- pnpm run test:integration
```

## Non-goals

- Do not require full Conventional Commits.
- Do not add `commitlint`.
- Do not enforce commit messages in CI unless the convention starts to drift enough to cause real review friction.
- Do not maintain a strict area registry unless loose consistency stops being enough.