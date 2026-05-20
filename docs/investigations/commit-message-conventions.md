# Investigation: commit message conventions

Status: Current investigation
Date: 2026-05-20
Related: README workflow conventions, AGENTS.md, PR #71, PR #95

## Question

What commit message convention should this repository use to keep history readable and consistent without introducing unnecessary process or tooling?

## Executive summary

This repository does not need full Conventional Commits or commit linting.

The best fit is a lightweight, human-readable convention inspired by Git and Node.js style:

```txt
<area>: <imperative summary>
```

Examples:

```txt
db: scope assessment saves to project
ci: skip expensive checks for docs-only changes
docs: add issue template conventions
agents: audit instruction ownership
ui: fix drawer close behavior on iPad
```

This gives agents and humans a stable pattern to imitate without requiring type classification, release automation, or enforcement.

## Context

Recent repository history mixes several styles:

```txt
docs: improve GitHub issue form templates
ci: checkout before path filtering
test(issue-19): harden reliability for DB constraints and managed question mutations
Fix assessment save collisions across projects and improve user recovery messages
Clarify label handling as GitHub metadata in templates and agent instructions
Fix #60: Refactor AppShell for reliable drawer behavior and improved tests
```

All of these are understandable, but the mixture makes it easy for coding agents to invent new conventions.

The goal is not strict compliance. The goal is to make the common case predictable.

## Options considered

### Option 1: no convention

Pros:

- zero process overhead;
- no time spent classifying changes.

Cons:

- history becomes uneven;
- agents keep copying whichever pattern they saw last;
- PR titles and squash commit messages drift.

Assessment:

This is acceptable for very small throwaway repositories, but the project now uses issues, PRs, plans, and agent-assisted workflows enough that a small convention is useful.

### Option 2: full Conventional Commits

Format:

```txt
<type>[optional scope]: <description>
```

Example:

```txt
fix(assessments): scope saves to project
```

Pros:

- widely recognized;
- good for automated changelogs and semantic release;
- familiar to many JavaScript/TypeScript developers;
- supported by Angular-style commit conventions.

Cons:

- requires choosing a type (`feat`, `fix`, `refactor`, `chore`, etc.);
- agents often overuse or misuse `chore`;
- the type can duplicate issue labels and PR taxonomy;
- no current automation depends on machine-readable commit types;
- scope lists tend to drift unless enforced.

Assessment:

Useful for projects that generate release notes or drive semantic versioning from commits. Too much structure for this repository right now.

### Option 3: area-prefixed commit messages

Format:

```txt
<area>: <imperative summary>
```

Example:

```txt
db: scope assessment saves to project
```

Pros:

- readable in `git log --oneline`;
- simple for agents to imitate;
- avoids `feat`/`fix`/`chore` classification debates;
- aligns with Git and Node.js style guidance;
- gives useful context without release automation.

Cons:

- less machine-readable than Conventional Commits;
- areas still need loose consistency;
- not enough if future release automation needs semantic types.

Assessment:

Best current fit.

## References and prior art

### Git project

Git's contribution guidance emphasizes that commit messages should explain why a change is needed and how the approach solves the problem. It recommends a short first line, often prefixed with an area or file-like identifier, such as:

```txt
doc: clarify distinction between sign-off and pgp-signing
githooks.txt: improve the intro section
```

It also recommends imperative mood and looking at nearby history when choosing the area.

Source: `git/git` `Documentation/SubmittingPatches`.

### Node.js

Node.js recommends a first line that is short, lowercase except for proper nouns/code identifiers, prefixed with the changed subsystem, and written with an imperative verb.

Examples from the Node.js guide:

```txt
net: add localAddress and localPort to Socket
src: fix typos in async_wrap.h
```

It also says commit bodies should explain what changed and why.

Source: `nodejs/node` `doc/contributing/pull-requests.md`.

### Angular / Conventional Commits

Angular uses a stricter format:

```txt
<type>(<scope>): <short summary>
```

with types such as `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, and `test`.

Angular's rationale is readable history and changelog generation.

Source: `angular/angular` `contributing-docs/commit-message-guidelines.md`.

This is valuable when release tooling consumes commit messages, but this repository does not currently need that level of structure.

## Recommendation

Adopt a lightweight preference:

```txt
<area>: <imperative summary>
```

Do not add commit linting or blocking checks.

Treat the convention as guidance for humans and agents, especially for PR titles and squash commit titles.

## Suggested areas

Use a stable area that describes the main subsystem or intent.

Suggested areas:

```txt
app
ui
db
migrations
import
export
assessments
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

Examples:

```txt
db: scope assessment saves to project
```

is better than:

```txt
db/tests/docs: scope assessment saves to project
```

## Guidance

Use imperative wording after the prefix:

```txt
fix
add
remove
document
clarify
scope
rename
simplify
```

Do not use issue numbers as the area.

Prefer:

```txt
db: harden question mutation constraints
```

over:

```txt
test(issue-19): harden reliability for DB constraints
```

Put issue references in the PR body or commit body instead:

```txt
Fixes #19
Related to #83
```

For non-trivial commits, add a body explaining:

- why the change is needed;
- what approach was taken;
- any important validation.

Example:

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

- Do not add `commitlint`.
- Do not enforce commit messages in CI.
- Do not require Conventional Commits.
- Do not maintain a strict area registry unless drift becomes a real problem.

## Possible follow-ups

- Add a short commit message section to README or `docs/guides/contributing.md`.
- Add one line to `AGENTS.md` telling agents to prefer the lightweight area-prefix convention.
- If PR titles continue to drift, document PR title guidance before considering tooling.
