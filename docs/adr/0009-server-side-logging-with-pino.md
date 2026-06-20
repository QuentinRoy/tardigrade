# Server-side logging uses a shared pino logger, scoped to unexpected/operational events

Status: accepted

All server-side code that needs to report an unexpected or operational event it does not throw — a background failure, a recovered error, a startup/shutdown notice — logs through the shared logger at `src/logger.ts`, not `console.*`. Biome's `noConsole` rule already forbids `console.*` outside that one exception; this ADR establishes what replaces it and when to use it.

## Why

`src/db/kysely.ts` needed to attach a `pool.on("error", ...)` listener: node-postgres re-emits a backend-initiated client disconnect (Postgres restart, network blip, connection-limit kill, failover) as an `'error'` event on the pool, and an unlistened `'error'` event throws via Node's `EventEmitter`, crashing the whole Next.js server process. That listener has to report the error somehow without throwing, but the repo had no logger and `console.*` is lint-banned with no existing exception. Picking `console.error` there would have created a precedent of one ad-hoc unstructured logging call with no convention behind it.

`pino` was chosen over alternatives (a hand-rolled `console.error` wrapper, `consola`) because it is a structured, widely-used Node logger with low setup overhead and no further decisions needed (transport, formatting) for this repository's current scale.

## Rules

1. Server-side code imports `logger` from `src/logger.ts` to report something worth knowing about that is not itself thrown as an error to a caller. Typical cases: a caught error that is intentionally swallowed (like the pool `'error'` listener), a recovered retry, or a startup/shutdown notice.
2. Do not log and then also throw or re-throw the same error from the same code path — that produces duplicate noise. Log at the point where the error is being swallowed or handled, not at every layer it passes through.
3. Call `logger.error(...)`, `logger.warn(...)`, etc. with a structured first argument (`{ error }`, `{ submissionId }`, ...) and a short message string second, following pino's `(mergingObject, message)` call shape — not string concatenation. This keeps log lines machine-parseable.
4. Do not log values that fall inside the **System-wide Row ID Boundary** (CONTEXT.md) or any student-identifying grading content (names, submitted answers, grades) in a log line. Logging is for operational/diagnostic context, not domain payloads. Log identifiers that are already public (Project ID, submission ID used as an opaque token) rather than full records.
5. `src/logger.ts` stays a thin export of one configured `pino()` instance. Do not introduce a second logger instance, a wrapper module, or per-feature logger configuration without revisiting this ADR.
6. This is not a request-tracing or audit-logging system. If a feature needs structured audit trails, per-request correlation IDs, or log shipping to an external sink, treat that as a new decision, not an extension of this one.

`src/logger.ts` is a cross-cutting infrastructure module (like `src/db`), not a feature folder, so it is exempt from [ADR-0006](0006-prefer-flat-module-structure.md)'s feature-folder flatness rule by the same reasoning `src/db` is.

## Considered Options

- **`console.error` with a one-off `biome-ignore`**: rejected. Introduces the repo's first lint suppression for a rule with no other exceptions, for a problem a real (if minimal) logger solves cleanly.
- **Empty no-op `pool.on("error", () => {})`**: rejected. Prevents the crash but silently discards diagnostic information about a real operational event (a database disconnect), making the next incident harder to diagnose.
- **`consola`**: considered; rejected in favor of `pino` for being closer to a de facto Node.js server-logging standard with broader ecosystem support, even though `consola`'s pretty-printed output has lower setup overhead.
- **Defer the decision and use `process.stderr.write` for now**: rejected once a library choice (`pino`) was made; an ad-hoc placeholder would just be a second thing to migrate away from later.

## Consequences

- Future server-side code that needs to report a non-thrown error or operational event has one obvious place to import from (`src/logger.ts`) instead of reaching for `console.*` or inventing another ad-hoc pattern.
- `pino` is now a runtime dependency; no log transport, redaction, or shipping configuration exists yet — only the default synchronous-by-default pino instance. Adding those is a separate, deliberate decision when a real need (e.g., production log aggregation) arises.
- `AGENTS.md`'s "Error handling UX" section governs *user-facing* error messages; this ADR governs *operational* logging that is never shown to a user. The two are not in tension, but a future contributor should not conflate "log it" with "tell the user."
