# Investigation: agent instruction architecture audit

Status: Completed
Date: 2026-05-26
Resolution: Implemented by PR #119, which closes issue #97.
Follow-up: None.
Related: PR #71, PR #82, issue #97, PR #119, AGENTS.md, Copilot instructions, README workflow conventions

## Question

How should repository instructions be organized so that coding agents reliably follow repository conventions without introducing duplicated or conflicting guidance?

## Resolution summary

PR #119 implements the accepted lightweight instruction ownership structure:

- `AGENTS.md` owns short operational rules, mandatory reminders, and navigation.
- README owns onboarding and contributor entry points.
- Copilot instructions are limited to tool-specific glue.
- `docs/*` owns durable knowledge, rationale, and expanded guidance.

The cleanup is considered complete for issue #97. The remaining short engineering reminders in `AGENTS.md` are intentionally kept as always-relevant operational guidance for now.

## Implemented in PR #119

- Reduced Copilot instructions to a short pointer to `AGENTS.md`.
- Moved local skill-loading guidance into `AGENTS.md`.
- Added explicit instruction precedence to `AGENTS.md`.
- Shortened README workflow guidance and linked to `docs/guides/issue-and-pr-conventions.md`.
- Aligned plan-path guidance around `plans/active/` and `plans/completed/`.
- Added documentation placement and lifecycle guidance to `docs/index.md`.
- Cleaned README command drift.
- Clarified PR template plan wording so it no longer claims `AGENTS.md` requires plan files.

## Accepted ownership decisions

- `AGENTS.md` is the canonical source for operational agent rules.
- Tool-specific instruction files may point to `AGENTS.md`, but should not duplicate repository-wide policy.
- Local skill-loading guidance belongs in `AGENTS.md`.
- README or contributor documentation owns human-facing workflow overviews.
- Issue and PR templates own detailed structure and checklist prompts.
- Durable architecture and repository knowledge belongs in `docs/*`.
- Investigations and active plans can guide work, but they do not override higher-priority decisions.

## Audit findings preserved as rationale

The cleanup addressed these drift risks:

- issue, PR, template, and label workflow appeared in multiple places;
- planning guidance had stale or conflicting plan paths;
- validation, migration, label, and error-handling policy was duplicated in tool-specific instructions;
- local skill-loading policy lived in a tool-specific file even though it applies to all agents;
- source precedence was accepted in issue #97 but needed to be made explicit in `AGENTS.md`;
- README was expanding from entry point into operational manual.

The chosen resolution keeps detailed collaboration workflow in `docs/guides/issue-and-pr-conventions.md`, keeps the documentation map and lifecycle rules in `docs/index.md`, keeps long-lived system facts in `docs/reference/`, and keeps `AGENTS.md` short and operational.
