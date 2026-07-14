# Issue and PR Conventions

This document defines conventions used for repository collaboration artifacts such as GitHub issues and pull requests (or their equivalents on other platforms, such as GitLab merge requests).

GitHub is currently the platform used by this repository, but these conventions are intended to remain portable across repository hosting platforms.

## Templates

Issue and PR templates are intended to provide useful structure where it improves consistency or reduces missing information.

In most cases, existing templates should be used.

Templates should guide contributors, but sections should not be completed with invented information solely to satisfy the template. If a section is not applicable or the information is unknown, explicitly state that rather than introducing unsupported assumptions or artificial relationships.

## Draft pull requests

Draft pull requests may use short TODO lists to track immediate incomplete implementation work, validation steps, or open questions.

Keep TODO lists lightweight. If the remaining work becomes large enough to need substantial planning, create or link a plan document under `plans/`. Plan documents remain the preferred place for non-trivial planning. Mark the plan's `Status` field `Completed` as part of the same PR, before it merges — see [docs/index.md](../index.md#plans) — rather than leaving it for a follow-up PR.

TODO lists should not replace issue descriptions, acceptance criteria, follow-up issues, or plan documents when those are the better long-term record.

Before marking a PR as ready for review, resolve or remove temporary TODO items where possible.

## Branch freshness

Before creating a pull request and before pushing further commits to one, check whether its base branch has moved. If so, update the branch first.

Pull requests must be up to date with their base branch before the user merges them.

## Pull request titles

Prefer the commit message convention in `docs/guides/commit-message-conventions.md` for pull request titles when it stays readable:

```txt
<area>: <imperative summary>
```

Examples:

```txt
grids: centralise slug canonicalisation behind a route-kind helper
docs: clarify TypeScript function parameter conventions
```

A more descriptive title is acceptable when the area-prefixed shape would hide important review context.

## Labels

Labels are shared across issues and pull/merge requests.

### Principles

- One label = one dimension
- Prefer broad reusable labels
- Prefer reusing existing labels over creating new ones
- Labels should help filtering and scanning

### Work types

- feature: New product capability or user-facing improvement.
- bug: Observed broken behavior or regression.
- investigation: Needs exploration, design clarification, or technical audit before implementation.
- documentation: Documentation improvements or additions.

### Reliability

- reliability: Correctness, data safety, robustness, or regression-prevention work.
- tier-0: Highest-priority reliability risk; address before lower tiers.
- tier-1: Important reliability risk; address after tier-0 work.
- tier-2: Lower-priority reliability hardening or contract coverage.

### Areas

- ui: User interface, interaction design, navigation, forms, or visual feedback.
- rubrics: Rubric and criterion model, marks configuration, or rubric editing.
- grading: Grading workflow, grade state, grading navigation, or completion tracking.
- database: Database schema, migrations, persistence, identifiers, or data integrity.
- import-export: Import, export, backup, restore, portable formats, or file exchange.
- testing: Tests, CI checks, quality gates, or test infrastructure.
- accessibility: Accessibility, keyboard support, focus management, ARIA, or assistive technology concerns.
- auth: Authentication, users, sessions, passkeys, ownership, or access control.
- i18n: Internationalization, translation, locale selection, or localized formatting.

### Priority and triage

- low priority: Useful but not urgent; defer unless already working nearby.
- duplicate: This issue or pull request already exists.
- invalid: This does not seem right.
- wontfix: This will not be worked on.
- question: Further information is requested.
- help wanted: Extra attention is needed.
- good first issue: Good for newcomers.

## Typical combinations

- feature + rubrics + ui
- feature + grading + database
- reliability + tier-0 + database
- investigation + ui

## Notes

Pull/merge request labels should generally mirror the issue being addressed.
