# Issue and PR Conventions

This document defines conventions used for repository collaboration artifacts such as GitHub issues and pull requests (or their equivalents on other platforms, such as GitLab merge requests).

GitHub is currently the platform used by this repository, but these conventions are intended to remain portable across repository hosting platforms.

## Templates

Issue and PR templates are intended to provide useful structure where it improves consistency or reduces missing information.

Templates should guide contributors, not force information that may be unknown or encourage placeholder content.

Use structured templates when information is consistently expected (for example bug reports or feature requests). Prefer free-form issues when work varies substantially or when a template could encourage unsupported assumptions or artificial relationships.

## Labels

Labels are shared across issues and pull/merge requests.

### Principles

- One label = one dimension
- Prefer broad reusable labels
- Prefer reusing existing labels over creating new ones
- Labels should help filtering and scanning

### Work types

- feature: New capability or user-facing improvement
- bug: Observed broken behavior or regression
- investigation: Needs exploration before implementation
- documentation: Documentation work

### Reliability

- reliability: Correctness, robustness, and data safety concerns
- tier-0: Highest-priority reliability risk
- tier-1: Important reliability risk
- tier-2: Lower-priority hardening work

### Areas

- ui
- rubrics
- assessment
- database
- import-export
- testing
- accessibility
- auth
- i18n

## Typical combinations

- feature + rubrics + ui
- feature + assessment + database
- reliability + tier-0 + database
- investigation + ui

## Notes

Pull/merge request labels should generally mirror the issue being addressed.
