# Server-side logging uses a shared pino logger, scoped to unexpected/operational events

Status: accepted

All server-side code that needs to report an unexpected or operational event it does not throw — a background failure, a recovered error, a startup/shutdown notice — logs through a scoped logger created from `src/utils/logger.ts`, not `console.*`. Biome's `noConsole` rule already forbids `console.*` outside that one exception; this ADR establishes what replaces it and when to use it.

## Why

`src/db/kysely.ts` needed an `'error'` listener somewhere on its connection pool: node-postgres re-emits a backend-initiated client disconnect (Postgres restart, network blip, connection-limit kill, failover) as an `'error'` event, and an unlistened `'error'` event throws via Node's `EventEmitter`, crashing the whole Next.js server process. That listener has to report the error somehow without throwing, but the repo had no logger and `console.*` is lint-banned with no existing exception. Picking `console.error` there would have created a precedent of one ad-hoc unstructured logging call with no convention behind it.

`pino` was chosen over alternatives (a hand-rolled `console.error` wrapper, `consola`) because it is a structured, widely-used Node logger with low setup overhead and no further decisions needed (transport, formatting) for this repository's current scale.

## Rules

1. Server-side code obtains a logger with `createLogger(scope)` from `src/utils/logger.ts` to report something worth knowing about that is not itself thrown as an error to a caller. Typical cases: a caught error that is intentionally swallowed (like the pg client `'error'` listener in `src/db/kysely.ts`), a recovered retry, or a startup/shutdown notice. Create the scoped logger once at module top and reuse it.
2. `scope` is a closed union — the feature folders (`assessments`, `export`, `import`, `projects`, `questions`, `rubrics`, `submissions`) plus the `db` infrastructure module. A module logs under the scope of the subsystem it belongs to. Adding a scope means extending the `LogScope` union in `src/utils/logger.ts`; do not pass a free-form string. The closed union exists so scope names cannot drift or be typo'd across call sites, and so logs are filterable by a known, stable set of subsystems.
3. Do not log and then also throw or re-throw the same error from the same code path — that produces duplicate noise. Log at the point where the error is being swallowed or handled, not at every layer it passes through.
4. Call `logger.error(...)`, `logger.warn(...)`, etc. with a structured first argument (`{ err: error }`, `{ submissionId }`, ...) and a short message string second, following pino's `(mergingObject, message)` call shape — not string concatenation. This keeps log lines machine-parseable. (The `scope` field is attached automatically by the child logger; do not repeat it per call.) When the value being logged is an `Error`, the key **must** be `err`: pino's default configuration only applies its Error serializer (message, type, stack) to that key, so logging an error under any other key (for example `{ error }`) silently drops the stack and most useful details.
5. Do not log values that fall inside the **System-wide Row ID Boundary** (CONTEXT.md) or any student-identifying grading content (names, submitted answers, grades) in a log line. Logging is for operational/diagnostic context, not domain payloads. Log identifiers that are already public (Project ID, submission ID used as an opaque token) rather than full records.
6. `src/utils/logger.ts` stays a thin module: one root `pino()` instance and the `createLogger` scope factory. Do not introduce a second root instance, a wrapper layer, or per-feature logger configuration without revisiting this ADR.
7. This is not a request-tracing or audit-logging system. If a feature needs structured audit trails, per-request correlation IDs, or log shipping to an external sink, treat that as a new decision, not an extension of this one.

## Correction: pool-level listener was insufficient

The original version of this ADR and `src/db/kysely.ts` attached the `'error'` listener to the `Pool` itself (`pool.on("error", ...)`). Reproducing a multi-connection backend disconnect in isolation (a plain `pg.Pool` with several idle connections, no Next.js involved) showed this listener reliably misses one case: one idle client throws `Error: Connection terminated unexpectedly` as an uncaught exception instead of emitting on the pool — a known node-postgres gap (https://github.com/brianc/node-postgres/issues/1986). `src/db/kysely.ts` now attaches the listener to each client individually (`pool.on("connect", client => client.on("error", ...))`), confirmed in the same reproduction to catch every disconnect, including that one. The logging decision (rule 1, `pino` via `createLogger`) is unchanged; only the listener's attachment point moved from the pool to each client.

## Considered Options

- **`console.error` with a one-off `biome-ignore`**: rejected. Introduces the repo's first lint suppression for a rule with no other exceptions, for a problem a real (if minimal) logger solves cleanly.
- **Empty no-op `'error'` listener (`() => {}`)**: rejected. Prevents the crash but silently discards diagnostic information about a real operational event (a database disconnect), making the next incident harder to diagnose.
- **`consola`**: considered; rejected in favor of `pino` for being closer to a de facto Node.js server-logging standard with broader ecosystem support, even though `consola`'s pretty-printed output has lower setup overhead.
- **Defer the decision and use `process.stderr.write` for now**: rejected once a library choice (`pino`) was made; an ad-hoc placeholder would just be a second thing to migrate away from later.
- **A top-level `src/logger.ts` file**: rejected. `src` otherwise contains only directories, and a single loose top-level file would be the first exception to that pattern. `src/utils/` already holds cross-cutting helpers and is not a feature folder, so placing the logger there fits the existing structure without a new carve-out.
- **A free-form `logger.child({ scope })` at each call site, or no scopes at all**: rejected. With the scope vocabulary already fixed by the feature-folder structure, a closed `LogScope` union costs almost nothing to enforce at this one call site and prevents scope-string drift before it can start. Leaving scopes unstructured would defer that cost to a later, larger cleanup.

## Consequences

- Future server-side code that needs to report a non-thrown error or operational event has one obvious place to import from (`src/utils/logger.ts`) instead of reaching for `console.*` or inventing another ad-hoc pattern, and tags it with a known subsystem scope.
- `pino` is now a runtime dependency; no log transport, redaction, or shipping configuration exists yet — only the default `pino()` instance, which writes asynchronously (buffered, non-blocking) to stdout via `sonic-boom`, not synchronously. Adding a transport, redaction, or shipping config is a separate, deliberate decision when a real need (e.g., production log aggregation) arises.
- `AGENTS.md`'s "Error handling UX" section governs *user-facing* error messages; this ADR governs *operational* logging that is never shown to a user. The two are not in tension, but a future contributor should not conflate "log it" with "tell the user."
