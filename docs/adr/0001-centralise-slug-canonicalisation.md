# Centralise project slug canonicalisation behind a route-kind helper

Status: superseded by ADR-0005

Project-scoped pages carry a cosmetic **Project Slug** segment alongside the authoritative **Project ID**; when the slug is stale the page redirects to the **Canonical Project URL**. This rule was copied inline into 9 pages, and two copies had already drifted to the wrong target (the overview page redirected to the dashboard, the assessments page to the overview). We centralise the rule behind a single `canonicalProjectRedirect(project, requestedSlug, route)` helper to which each page passes only its **route kind**; the helper owns the slug compare and maps the kind to the canonical path via `projectPaths`.

## Considered Options

- **Layout-level canonicalisation** — rejected: the project layout receives only its own params (`projectId`, `projectSlug`), not deeper segments (`submissionId`, `questionId`) or the full pathname, so it cannot rebuild the canonical URL for deep routes.
- **Middleware** — rejected: middleware sees the full path but would need the project's current slug to compare against, i.e. a DB lookup at the edge.
- **Extract the slug compare only, page supplies the built path** — rejected: each page still chooses its own target, which is exactly the mistake that produced the two wrong-target bugs.

## Consequences

This supersedes the per-page decision recorded in `plans/completed/2026-05-29-project-route-context-cleanup.md` ("redirect targets are page-specific"). The helper makes redirecting to the *wrong* canonical target a compile-time concern (kinds map 1:1 to `projectPaths` builders via an exhaustive switch), but it does not prevent a brand-new page from forgetting to canonicalise at all — only a layout or middleware could, and both were rejected above.
