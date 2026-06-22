# Grading-client extractions

Status: Active
Date: 2026-06-21
Source: `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md` Priority 7 / Finding 14
Issue: none yet — a dedicated implementation issue is needed when work starts (the #115 umbrella is closed). No existing issue tracks this; tangential ones are #30 (assessment-session optimistic tests), #84 (iPad save errors), #86 (message centralization).

## Guidance consulted

- `AGENTS.md`, `CONTEXT.md` (glossary checked — no change; the terms here are UI/implementation, not domain language), `docs/index.md`.
- Audit `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md`, Finding 14 / Priority 7.
- ADR 0006 (prefer flat module structure), ADR 0004 (avoid barrel files).
- `docs/reference/testing-conventions.md` — the `unit`/`integration` projects run in Node (no `window`/`document`/`HTMLElement`); browser behavior is covered by Storybook play functions run headless via Playwright.
- `.agents/skills/simplify/SKILL.md` (post-edit simplify pass), `.agents/skills/grill-with-docs` (this planning session).
- `docs/guides/issue-and-pr-conventions.md`, `docs/guides/commit-message-conventions.md`.

## Decisions made while grilling (2026-06-21)

1. **Scope:** extract the quick-jump hook and remove the redundant current-submission lookup. Leave the prev/next navigation toolbars separate (audit: different paths, prefetch, and completion-color only on the question page).
2. **Keep the save-error payload inline.** `buildSaveErrorContext` was evaluated and **dropped**: it reduces to an object literal, defining it per-client wouldn't dedupe across files, and a shared identity-function helper adds a module for no real saving. The audit's own WET-before-DRY principle applies. This diverges from the audit's candidate list.
3. **Hook shape and name:** `src/assessments/useSubmissionQuickJump.ts` (not the audit's `useSubmissionQuickJumpShortcut`, because it owns the open/close state, not just the shortcut). It returns `{ isOpen, open, close }`. The internal `useEffect` uses the stable state setter, so its dependency array stays `[]`; `open`/`close` are plain wrappers (no `useCallback` — the dialog/button are not memoized).
   - The global Cmd/Ctrl+K listener stays a `useEffect` subscription with a `removeEventListener` cleanup — the legitimate "subscribe to an external system" case, not an Effect anti-pattern. Alternatives were considered and rejected: `useSyncExternalStore` reads an external *value* (as `src/utils/useLocalStorage.ts` does), not a one-shot event; a JSX `onKeyDown` cannot capture a shortcut fired while focus is elsewhere, so a `window` listener is required; and `useEffectEvent` is unnecessary (the handler reads no reactive values, deps are genuinely `[]`) and still experimental in React 19.
4. **Redundant lookup:** route each client's current-submission lookup through the shared `getSubmissionNavigation` (the same helper `useAssessmentSession` uses) instead of a separate `submissions.find`. One `currentSubmission`/label per client feeds the display (question page only), the guard, and the inline save-error. The double null-check guard (`sessionCurrentSubmission == null || currentSubmission == null`) collapses to one. The hook still recomputes navigation internally; that pure `findIndex` is negligible and removing it would require changing the hook's API (out of scope).
5. **Testing:** one Storybook play harness for the hook — Cmd/Ctrl+K opens; typing in an input/textarea is guarded; Escape/close works. The Node unit tier cannot exercise the `window` listener or the `HTMLElement` focus guard. Not trying to satisfy #30's broader session/optimistic tests here.
6. **Docs:** no `CONTEXT.md` change (glossary stays implementation-free) and no ADR (the change is reversible, unsurprising, and the one real trade-off is covered by the audit's WET principle and ADR 0006). The UI-label inconsistency (code "quick jump" vs button "Lookup" vs dialog "Find submission") is noted as an optional, out-of-scope follow-up.

## Implementation steps

Done — #197 (2026-06-21). Behavior-preserving extraction of working code; each client's observable behavior is unchanged.

1. ✅ **`src/assessments/useSubmissionQuickJump.ts`** — the Cmd/Ctrl+K `useEffect` (with the input/textarea/contentEditable guard) and the open state now live in the hook; returns `{ isOpen, open, close }`.
2. ✅ **`src/assessments/useSubmissionQuickJump.stories.tsx`** — harness component plus three play functions: Cmd/Ctrl+K opens; a focused input guards the shortcut; the open/close controls work.
3. ✅ **Refactor `SubmissionAssessmentClient.tsx`** — replaced the copied effect + `useState` + open/close handlers with `useSubmissionQuickJump`; `currentSubmission` now comes from `getSubmissionNavigation`; the guard collapsed to one check; the inline save-error object is unchanged.
4. ✅ **Refactor `SubmissionOverviewAssessmentClient.tsx`** — same, with the unknown-rubric-mapping branch preserved.
5. ✅ **Simplify pass** + checks (see Validation).

## Validation

- `pnpm run check --fix` — clean (only import-order autofix on the changed files).
- `pnpm run check-types` — clean.
- `pnpm test:storybook useSubmissionQuickJump` — 3/3 play tests pass (`OpensOnShortcut`, `IgnoresShortcutWhileTyping`, `OpenAndCloseControls`).
- No other stem-matched unit tests exist (the two clients and `useAssessmentSession` are untested today; broader session coverage is #30).

## Non-goals

- No `buildSaveErrorContext` helper (kept inline).
- No shared prev/next navigation toolbar component.
- No single mega grading-client component (audit caution).
- No UI-label harmonization (Lookup / Find submission / quick jump).
- No `CONTEXT.md` or ADR change.
- Not the broader grading-client/session test coverage owned by #30.
