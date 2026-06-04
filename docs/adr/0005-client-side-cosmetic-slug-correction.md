# Correct cosmetic project slugs client-side instead of redirecting

Status: accepted (supersedes ADR-0001)

A stale **Project Slug** is a cosmetic address-bar issue, not a routing error — the **Project ID** already resolves the project. We replace the stale slug segment in place via a client component (`usePathname()` + `window.history.replaceState()`) mounted in each slug-bearing layout, and remove the per-page server `canonicalProjectRedirect` entirely. The component delegates to a pure `canonicalizeSlugSegment(pathname, id, slug)` helper that finds the segment equal to `id` and rewrites the segment immediately after it; the same component serves project slugs now and submission-target slugs later (#136) by mounting it in deeper layouts.

This defeats the objection that retired ADR-0001: that approach rejected layout-level canonicalisation because a *server* layout sees only its own params and cannot rebuild the canonical URL for deep routes. A *client* component reads the full live pathname and patches a single segment, so it never rebuilds the URL — which also removes the entire class of wrong-target bugs ADR-0001's route-kind→`projectPaths` mapping existed to prevent, since there is no target to misbuild.

## Considered Options

- **Per-page server redirect (ADR-0001)** — superseded: correct, but adds a redirect round-trip per stale URL and a per-page call a new page can forget; its compile-time wrong-target protection is moot once we patch a segment instead of rebuilding the URL.
- **Proxy / middleware canonicalisation** — rejected: needs a DB lookup at the edge to know the current slug.
- **Proxy passes the pathname to layouts** — rejected: internal-header plumbing, and unreliable across reused client-side layout navigations.

## Consequences

The server still renders once under the stale URL before the client corrects it; acceptable because slugs are cosmetic. **This holds only while slugs stay cosmetic** — if a slug ever affects lookup, authorization, cache identity, or rendered data, canonicalisation must move back server-side.

The helper throws on structural violations (`id` absent from the pathname, or `id` as the last segment with no slug slot after it); neither can occur under correct mounting, so the throw surfaces misuse (wrong layout or wrong `id` prop) rather than firing in normal operation.

Project renames (future UI) need no slug history and no redirects. Because identity is the stable **Project ID** and the slug is derived from the name, a rename mutation that revalidates the project's cache tag (`projectCacheTag(id)`) causes the layout to re-render with the new derived slug; the client component then corrects any open URL in place via `replaceState`, with no navigation. The rename mutation is responsible for that revalidation — without it the new slug only appears after `cacheLife` expiry or a navigation.
