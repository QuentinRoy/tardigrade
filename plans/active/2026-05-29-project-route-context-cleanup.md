# Project route-context and path-helper cleanup

Status: Active
Date: 2026-05-29
Resolution: —
Follow-up: None

Implements the remaining items from issue #117: "Extract a focused project route-context" and "Implement project route-context and path-helper cleanup as a small PR."

## Goals

- Rename `routes.ts` to `projectPaths.ts` so path helpers have unambiguous domain ownership.
- Replace the lossy slug-to-display-name reconstruction with the real project name from the DB.
- Centralise project-existence enforcement in the layout so pages don't repeat it.
- Give pages a non-nullable `ProjectSummary` from TypeScript without a null-check at every callsite.

## Changes

### 1. Refactor `src/db/projects.ts` — split cached internals from exported wrapper

Extract the `"use cache"` query into a module-private function. The exported function becomes a non-cached wrapper with overloads so callers can express intent:

```ts
// internal — not exported; cache key is just publicId
async function loadProjectCached(
  publicId: string,
): Promise<ProjectSummary | undefined> {
  "use cache";
  // ...existing DB query unchanged...
}

export async function loadProjectByPublicId(
  publicId: string,
  options: { required: true },
): Promise<ProjectSummary>;
export async function loadProjectByPublicId(
  publicId: string,
  options?: { required?: false },
): Promise<ProjectSummary | undefined>;
export async function loadProjectByPublicId(
  publicId: string,
  { required = false }: { required?: boolean } = {},
): Promise<ProjectSummary | undefined> {
  const project = await loadProjectCached(publicId);
  if (project == null && required) {
    throw new Error(`Unexpected: project not found: ${publicId}`);
  }
  return project;
}
```

Cache key is `(loadProjectCached, publicId)` — unchanged. Layout and page calls with or without `{ required: true }` share the same cache entry.

### 2. Rename `src/projects/routes.ts` → `src/projects/projectPaths.ts`

`routes.ts` is ambiguous next to Next.js `route.ts` API files. Rename and update imports everywhere.

- `src/projects/routes.ts` → `src/projects/projectPaths.ts`
- `src/projects/routes.test.ts` → `src/projects/projectPaths.test.ts`
- Update imports in: `AppShellDrawerContent.tsx`, `AppShellNavigationShell.tsx`, all page and route files under `app/projects/[projectId]/[projectSlug]/`.

### 3. Remove `displayProjectName` from `src/shared/AppShell.shared.ts`

The function reconstructs a display name from the slug (lossy — `cs-101` → `Cs 101` instead of the real `CS 101`). Delete it; the real project name now flows from the layout.

`ProjectRouteContext` and `getProjectRouteContext` stay in `AppShell.shared.ts` — they serve the client-side nav shell's path-building needs.

### 4. `AppShell` — discriminated union prop type

```ts
type AppShellProps =
  | { showNavigation: true; projectName: string; children: ReactNode }
  | { showNavigation?: false; children: ReactNode };
```

Thread `projectName` through to `AppShellNavigationShell` for the top-bar title. When `showNavigation` is false (e.g. the projects list page) no name is available or needed.

### 5. Project-scoped layout — gatekeeper and name provider

`app/projects/[projectId]/[projectSlug]/layout.tsx` becomes async:

```ts
export default async function ProjectScopedLayout({ children, params }) {
  const { projectId } = await params;
  const project = await loadProjectByPublicId(projectId);
  if (project == null) notFound();
  return <AppShell showNavigation projectName={project.name}>{children}</AppShell>;
}
```

- Single user-facing 404 boundary for all project-scoped routes.
- Uses the nullable overload — `notFound()` is a navigation concern owned by this layout, not the DB layer.
- Subsequent page calls to `loadProjectByPublicId` are cache-served.

### 6. Pages — use `{ required: true }`, drop null checks

All pages under `app/projects/[projectId]/[projectSlug]/` switch to:

```ts
const project = await loadProjectByPublicId(projectId, { required: true });
```

- Return type is `ProjectSummary` (non-nullable) — no null check needed.
- Throws a server error if somehow null (defence-in-depth; the layout prevents this in practice).
- Slug redirect stays in each page since redirect targets differ per route.

Applies to the 9 top-level page components and the two `"use cache"` sub-components in `questions/[questionId]/page.tsx` (`QuestionHeaderSection`, `SubmissionRubricSection`) which receive `projectId` as a prop.

### 7. Export routes — unchanged

`export/submissions/route.ts` and `export/questions/route.ts` return JSON error responses (not `notFound()`). They continue calling `loadProjectByPublicId` without `{ required: true }` and handling null with `Response.json({ error: … }, { status: 404 })`.

## Execution order

1. Refactor `src/db/projects.ts` (split cached internals + overloads).
2. Rename `routes.ts` → `projectPaths.ts` and update all imports.
3. Update `AppShell` prop type (discriminated union) and remove `displayProjectName` from `AppShell.shared.ts`.
4. Update layout to be async gatekeeper passing `projectName`.
5. Update all pages and sub-components to use `{ required: true }`.
6. `pnpm run check --fix` + `pnpm run check-types`.

## Out of scope

- Moving `ProjectRouteContext` or `getProjectRouteContext` out of `AppShell.shared.ts`.
- Centralising slug redirects in the layout (redirect targets are page-specific).
- Any behaviour changes beyond the display-name fix.
