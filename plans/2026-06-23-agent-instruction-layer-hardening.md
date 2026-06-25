# Agent instruction layer hardening

- **Status:** Active
- **Created:** 2026-06-23
- **Origin:** Gap analysis of this repo against current web best practices for agent-facing documentation; tackles the "keep `AGENTS.md` minimal" principle in [`docs/guides/documentation-conventions.md`](../docs/guides/documentation-conventions.md) (the styling/code-style content is the always-loaded surface to trim) plus a verification-enforcement gap.
- **Tracked by:** none yet

## Guidance consulted

- `AGENTS.md` (the file being trimmed), `CONTEXT.md` (glossary checked — no domain-language change here), `docs/index.md`.
- `docs/guides/documentation-conventions.md` — the "keep `AGENTS.md` minimal / progressive disclosure" principle this plan acts on.
- `docs/investigations/2026-05-26-agent-instruction-architecture-audit.md` — accepted ownership: `AGENTS.md` is canonical for operational rules; tool-specific files are thin pointers; local skill-loading guidance lives in `AGENTS.md`.
- `.agents/skills/simplify/SKILL.md` (post-edit pass), `docs/guides/issue-and-pr-conventions.md`, `docs/guides/commit-message-conventions.md`.
- ADRs: none directly govern this; if "always-loaded `AGENTS.md` carries only operate/route/precedence/safety" is treated as a durable decision, a short ADR may be warranted (see Validation).

## Rationale (from the gap analysis)

The repo's documentation architecture already matches or exceeds best practice (two-layer model, thin tool pointers, ADRs, 14 skills, a `CONTEXT.md` glossary). The remaining gaps are in the always-loaded layer and in enforcement:

1. **Layer-1 carries conditionally-relevant policy.** `AGENTS.md` is 181 lines; roughly half (the **Styling** section, plus parts of **Architecture** / **Performance** / **Database migrations**) is only relevant when touching UI/DB, yet loads on every turn. Field guidance ("move sometimes-relevant knowledge into skills"; empirical evidence that non-essential always-loaded content lowers task success and raises cost) says demote it.
2. **Verification is advisory, not enforced.** `AGENTS.md` tells the agent to run `check` / `check-types` / targeted tests, but nothing guarantees it. Hooks are the recommended mechanism for "must happen every time."
3. **Minor drift surface.** ~22 concrete paths appear in the always-loaded file; the `src/...` code paths (e.g. `src/db/cacheTags.ts`, `src/utils/logger.ts`) are the drift-prone ones.

## Decisions to confirm before implementing

1. **Destination for the extracted styling content — recommend a skill.** A `ui-styling` skill under `.agents/skills/` fits the repo's "load skills only when the task touches that domain" model and keeps it agent-facing + on-demand. Alternative: `docs/guides/ui-styling.md` (human-facing; only loaded when routed). Recommendation: skill.
2. **Hook strategy — recommend PostToolUse + optional Stop.** A `PostToolUse` hook on `Edit`/`Write` running `biome check --write` on the changed file (fast, immediate), plus an optional `Stop` hook running `pnpm run check-types` (slower, whole-project gate). Must compose with the existing global RTK hooks in user settings — do not override them. Hooks are Claude-Code-only, so the advisory `AGENTS.md` line stays as the cross-tool fallback for Codex/Copilot.

## Scope

In scope:

- Move agent-applied **coding conventions** out of `AGENTS.md`'s always-loaded body into focused skills under `.agents/skills/`, leaving `AGENTS.md` with the pointer (and, for near-universal ones, an explicit "always consult" load line — the caveman pattern):
  - `ui-styling` ← **Styling** (MUI `mb`/`gap`, theme tokens). Conditional → auto-trigger.
  - `error-handling-ux` ← **Error handling UX** (no `NEXT_REDIRECT` to users, actionable, recovery path). Conditional → auto-trigger.
  - `testing` ← the `using`/`await using` disposable-fixture guidance (pairs with `docs/reference/testing-conventions.md`). Conditional → auto-trigger.
  - `react-patterns` ← `useId` for DOM ids + page composition (`app/` vs reusable `src/`); consider folding into the existing next-best-practices skill. Conditional → auto-trigger.
  - `typescript-api-design` ← convert the existing guide; **near-universal**, so route it via an explicit `AGENTS.md` "when writing TypeScript, consult …" load line (it won't reliably auto-trigger). Carry the guide's **current** content verbatim — including the "Type assertions" section and tab formatting added in PR #224 — then remove the guide and delist from `docs/index.md`.
- Extract **mechanically-checkable** rules to Biome lint. **`no as` is already done** (PR #224 enforced `biome-plugin-no-type-assertion`, removed the `as` casts, and documented the rationale in the typescript-api-design guide's "Type assertions" section). Still to check: whether React-namespace and `#private`-over-`private` can also be lint rules.
- Keep **genuinely universal** judgment/safety rules in `AGENTS.md` (readable code, naming, dead-code, scope; named-object-params one-liner; `Promise.all`; package.json scripts; don't weaken types; don't rewrite committed migrations; don't silently drop grading data).
- Add a deterministic verification hook in project `.claude/settings.json`.

Out of scope:

- Restructuring `AGENTS.md`'s operating protocol, instruction precedence, or routing table (these match the 2026-05-26 audit's accepted ownership).
- `CONTEXT.md` changes (no domain-language change).
- Generating reference docs (routes / env vars / schema) — a separate "Still open" investigation item, deferred.
- Nested `AGENTS.md` (single-app repo; not a monorepo — N/A).
- Introducing `SPEC.md` / spec-kit (`plans/` already serves plan-before-code).

## Steps

### Workstream A — minimize the always-loaded layer

1. [ ] Audit `AGENTS.md` sections for "conditionally relevant" vs "near-universal." Clear extract: **Styling**. Review **Architecture** / **Performance** / **Database migrations** for UI/DB-only content. Keep universal one-liners in `AGENTS.md` (no `as`, JS `#private` not TS `private`, flat structure, narrow scope, Project ID vs Row ID).
2. [ ] Create the destination per decision 1 (recommend `.agents/skills/ui-styling/SKILL.md`); move the styling content verbatim (bottom-spacing-only / `mb` not `mt` / `gap`, theme tokens over pixels).
3. [ ] Replace the extracted section in `AGENTS.md` with a single entry in the **Guidance routing** table pointing to the new home.
4. [ ] Re-check `AGENTS.md` for internal consistency (routing table, precedence list, no dead cross-references); confirm `CLAUDE.md` and `.github/copilot-instructions.md` still resolve (they point at `AGENTS.md`, so no change expected).
5. [ ] (Optional, minor) Replace drift-prone raw `src/...` references in the routing table with the owning ADR/doc where one exists.
6. [ ] Convert `docs/guides/typescript-api-design.md` → `.agents/skills/typescript-api-design/SKILL.md` by moving its **current** content verbatim (including PR #224's "Type assertions" section — do not regress it); because it's near-universal, route it via an explicit `AGENTS.md` "when writing TypeScript, consult …" load line (the caveman pattern) rather than relying on auto-trigger; remove the guide and delist from `docs/index.md`. (Its `no as` rule is already lint-enforced, PR #224.) Repeat steps 2–3 for `error-handling-ux`, `testing`, and `react-patterns`.

### Workstream B — deterministic verification gate

7. [ ] Implement the hook per decision 2 in project `.claude/settings.json` (committed), composing with existing global hooks.
8. [ ] Keep the advisory `check` / `check-types` / tests line in `AGENTS.md` as the cross-tool fallback.
9. [ ] Verify the hook fires: edit a file → confirm `biome` runs; trigger `Stop` → confirm `check-types` runs/gates. Capture evidence.

## Validation

- [ ] `AGENTS.md` line count meaningfully reduced; remaining content is near-universal.
- [ ] New skill/guide discoverable from the `AGENTS.md` routing table (and `docs/index.md` if a guide).
- [ ] `pnpm run check --fix` clean; `pnpm run check-types` clean.
- [ ] Hook demonstrably runs (evidence captured in the PR).
- [ ] Docs decision recorded: no `CONTEXT.md` change; decide whether the "always-loaded layer holds only operate/route/precedence/safety" rule deserves a short ADR or is adequately captured by this plan + the investigation.

## Non-goals

- No change to `AGENTS.md` precedence/protocol/routing structure.
- No `CONTEXT.md` edit.
- No generated reference docs.
- No nested `AGENTS.md`, no `SPEC.md`/spec-kit.
- Not weakening any rule — content is relocated, not deleted.
