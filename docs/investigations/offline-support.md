# Offline support and local assessment storage

## Status

Design note / architecture audit for #64, "Investigate optional offline grading mode".

This is an investigation note, not an implementation plan. It documents a possible long-term direction for optional offline grading support. It should be read as separate from, and lower priority than, the more immediate reliability work tracked in #63 around preventing silent grading-progress loss when the server is unavailable.

In other words:

- #63 should protect users from losing work when online saves fail;
- #64 asks whether the app should eventually support a more complete optional offline grading workflow;
- this document audits what that future workflow could look like, and which implementation approaches would be reasonable.

The current recommendation, if #64 is eventually implemented, is:

> Keep PostgreSQL as the canonical server-side source of truth, and add a browser-side IndexedDB store with an explicit local assessment outbox.

In practice, that would mean:

- use IndexedDB, probably through Dexie, for local project and assessment data;
- store local grading edits as durable domain commands in an outbox;
- replay those commands to the server when connectivity returns;
- keep explicit UI states for local save, sync, conflict, and failure;
- optionally add Service Worker / Workbox support if the app shell itself should load while offline;
- avoid duplicating the whole domain model or pretending the browser and server databases are the same thing.

## Context

The grading app is a rubric-based assessment tool. It imports project data, lets a grader assess submissions against rubric items, tracks grading progress, and exports results.

Issue #64 is about a possible optional offline grading mode. The motivating workflow is:

- assessment changes are stored locally;
- grading remains usable without a server connection;
- changes are queued;
- synchronization occurs automatically when connectivity returns;
- conflicts, if any, are detected and surfaced.

This is related to reliability, but it is a larger scope than simply preventing data loss when a save request fails. A smaller reliability fix might queue failed edits or warn users before they navigate away. A real offline mode implies local project data, local assessment state, synchronization, conflict handling, and UI semantics for local-vs-server state.

Offline support is valuable because grading may happen:

- with unreliable Wi-Fi;
- while commuting or moving between rooms;
- during oral exams or grading sessions where losing data would be severe;
- on a device that may suspend, reload, or briefly lose connectivity.

Assessment data is high-value data. Losing edits is worse than showing slightly stale project metadata. Therefore, offline support should primarily optimize for:

1. avoiding data loss;
2. making the local-vs-server state visible;
3. allowing safe recovery;
4. keeping the implementation understandable and testable.

## Goals

For #64, the goal would be to allow grading work to continue while disconnected or while the server is temporarily unavailable, with synchronization occurring later.

More concretely:

- Allow graders to continue editing assessment values when offline or temporarily disconnected.
- Persist unsynced assessment edits durably in the browser.
- Queue assessment changes explicitly rather than keeping them only in memory.
- Synchronize queued changes when connectivity returns.
- Keep the server-side PostgreSQL database as the canonical source of truth.
- Avoid silently losing or overwriting grades.
- Avoid building two unrelated domain models.
- Support explicit conflict detection for same-cell concurrent edits.
- Make sync status visible in the UI.
- Keep the first implementation reasonably small and auditable.
- Preserve the possibility of moving to a heavier local-first architecture later.

## Non-goals

At least for the first offline implementation, this should not try to provide:

- full real-time multiplayer collaboration;
- full browser-side parity with PostgreSQL;
- offline editing of all project configuration;
- offline import/export workflows;
- CRDT-based merging of grades;
- arbitrary SQL queries in the browser;
- complete transparent sync of every server table;
- background sync that works even when the app is never reopened.

Offline support should initially be scoped to project snapshots and assessment edits.

This should also not replace the simpler protections tracked in #63. If a minimal data-loss prevention fix is needed, it should probably happen first, even if the eventual offline design is broader.

## Summary recommendation

Use:

```txt
Server canonical DB:
  PostgreSQL + Kysely

Browser local DB:
  IndexedDB via Dexie

Offline app loading:
  Service Worker / Workbox or equivalent, only if broader offline app-shell support is needed

Sync model:
  Explicit assessment mutation outbox

Shared code:
  TypeScript domain types
  Zod schemas or equivalent validation
  Shared command constructors
  Shared conflict-policy helpers where possible
```

Avoid using the browser store as a generic cache of REST responses. Instead, store:

1. a local project snapshot;
2. local assessment state;
3. an append-only outbox of unsynced assessment commands;
4. sync metadata.

The core mental model should be:

> PostgreSQL is canonical. IndexedDB is a durable local replica plus pending command log. Commands are the synchronization boundary.

## Do we need two distinct stores?

Yes and no.

There will necessarily be two physical storage systems:

- PostgreSQL on the server;
- IndexedDB in the browser.

But the app should avoid having two unrelated domain models.

A good split would be:

```txt
shared/
  assessment-types.ts
  grading-commands.ts
  grading-validation.ts
  conflict-policy.ts

server/
  repositories using Kysely/PostgreSQL
  command handlers
  sync endpoint
  mutation log

client/
  Dexie local tables
  local project snapshot
  outbox processor
  sync status UI
```

The browser store should not mirror the entire server schema table-for-table unless there is a strong reason to do so. It should store a local projection optimized for offline grading.

## Recommended architecture

### 1. Offline app shell

The application shell only needs to be available offline if the goal is a complete offline mode where a grader can reopen the app while disconnected.

This is typically handled with:

- Service Worker;
- Workbox or a Next.js-compatible wrapper around Workbox;
- precaching of the app shell and critical assets;
- runtime caching for safe static resources.

This layer should only be responsible for loading the app. It should not be the main place where assessment data is stored.

Do not store assessment data in the Cache API. The Cache API is for HTTP responses and assets, not for domain data.

For a first #64 implementation, app-shell offline support can be deferred if the narrower target is only to protect edits made during a temporary connection loss while the app is already open.

### 2. Browser local database

Use IndexedDB for structured local data.

IndexedDB is appropriate because assessments are structured, queryable, and potentially larger than what should be placed in `localStorage`.

Avoid:

- `localStorage` for assessment data;
- `sessionStorage`;
- storing a giant JSON blob without indexes once the data becomes non-trivial;
- relying only on a React state store;
- relying only on TanStack Query's cache.

Use IndexedDB through a wrapper. The recommended wrapper is Dexie.

### 3. Local project snapshot

When a project is opened online, store a local snapshot of the project data needed for grading.

This may include:

- project ID;
- project slug;
- project display name;
- server revision;
- questions;
- rubrics;
- rubric values;
- submissions;
- students;
- existing assessments;
- grading progress projection if useful.

The local snapshot should be project-scoped.

Example sketch:

```ts
type LocalProjectSnapshot = {
  projectId: string;
  projectSlug: string;
  projectName: string;
  serverRevision: string;
  downloadedAt: string;
  schemaVersion: number;
};
```

The local store should allow the app to know which projects are available offline.

### 4. Local assessment state

Assessment edits should update a local materialized state immediately, so the UI remains responsive and usable offline.

Example sketch:

```ts
type LocalAssessment = {
  projectId: string;
  submissionId: string;
  rubricAssessmentId: string;

  value: unknown;
  comment?: string;

  localUpdatedAt: string;
  serverRevision?: string;

  dirty: boolean;
  conflict: boolean;
};
```

The exact shape should probably be more strongly typed by rubric kind:

```ts
type LocalBooleanAssessment = {
  projectId: string;
  submissionId: string;
  rubricAssessmentId: string;
  type: "boolean";
  passed: boolean | null;
  comment?: string;
  dirty: boolean;
};

type LocalOrdinalAssessment = {
  projectId: string;
  submissionId: string;
  rubricAssessmentId: string;
  type: "ordinal";
  selectedLabel: string | null;
  comment?: string;
  dirty: boolean;
};

type LocalNumericalAssessment = {
  projectId: string;
  submissionId: string;
  rubricAssessmentId: string;
  type: "numerical";
  score: number | null;
  comment?: string;
  dirty: boolean;
};
```

The local assessment state is the current client-side projection. It is not the durable audit trail. The durable audit trail is the outbox.

### 5. Mutation outbox

Every offline-capable edit should be stored as a command in an outbox.

This is the most important part of the design.

The outbox should be durable and append-only until commands are acknowledged by the server.

Example:

```ts
type OutboxMutation = {
  id: string; // globally unique client-generated command ID
  clientId: string;
  projectId: string;

  kind:
    | "setBooleanAssessment"
    | "setOrdinalAssessment"
    | "setNumericalAssessment"
    | "setAssessmentComment"
    | "clearAssessment";

  entityId: string;
  payload: unknown;

  baseServerRevision: string | null;

  createdAt: string;

  status: "pending" | "syncing" | "failed";
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
};
```

The outbox is what protects against data loss when:

- the network request fails;
- the tab closes;
- the device suspends;
- the app reloads;
- the server accepts some commands but not others;
- the same request is retried.

The application should not consider a mutation safely synchronized until the server has acknowledged the command ID.

### 6. Sync endpoint

Use a dedicated sync endpoint for assessment commands.

Example:

```txt
POST /api/projects/:projectId/sync-assessment-commands
```

Request:

```json
{
  "clientId": "browser-installation-id",
  "commands": [
    {
      "id": "cmd_01H...",
      "kind": "setOrdinalAssessment",
      "rubricAssessmentId": "ra_123",
      "submissionId": "sub_456",
      "selectedLabel": "Good",
      "baseRevision": "rev_123",
      "createdAt": "2026-05-19T18:12:00.000Z"
    }
  ]
}
```

Response:

```json
{
  "accepted": [
    {
      "id": "cmd_01H...",
      "acceptedRevision": "rev_124"
    }
  ],
  "rejected": [],
  "conflicts": [],
  "projectRevision": "rev_124",
  "patch": {
    "assessments": [
      {
        "rubricAssessmentId": "ra_123",
        "submissionId": "sub_456",
        "selectedLabel": "Good",
        "revision": "rev_124"
      }
    ]
  }
}
```

The server should be able to accept batches.

The server must treat command IDs as idempotency keys.

If the same command is submitted twice, the second submission should return the same outcome or a harmless already-applied response.

### 7. Server-side mutation log

The server should store a mutation log or idempotency table.

Example SQL-ish model:

```sql
assessment_mutation_log
  id                 text primary key
  project_id          text not null
  client_id           text not null
  user_id             text
  kind                text not null
  payload_json        jsonb not null
  base_revision       text
  accepted_revision   text
  status              text not null
  created_at          timestamptz not null
  applied_at          timestamptz
  rejected_reason     text
```

This protects against duplicate application and gives you an audit trail.

For a grading app, an audit trail is valuable because it can answer:

- when was this grade changed?
- from which client?
- was this command retried?
- was anything rejected?
- did a conflict occur?

Depending on how much auditability you want, the mutation log may be either a technical sync table or a real domain audit log.

### 8. Revision model

The sync model needs revision information.

Possible revision scopes:

1. project-level revision;
2. submission-level revision;
3. assessment-cell-level revision;
4. global monotonically increasing mutation sequence.

For the first implementation, per-assessment revision plus project revision is probably enough.

Example:

```ts
type AssessmentRevision = {
  assessmentId: string;
  revision: string;
  updatedAt: string;
};
```

A command should include the base revision that the client saw when the edit was made.

This allows the server to detect stale edits.

## Relationship with #63

The offline architecture described here is broader than the immediate data-loss protection in #63.

A likely sequencing is:

1. First, implement #63-level safeguards: failed save detection, visible errors, and protection against silently losing in-memory edits when the server is unavailable.
2. Then, if offline grading remains desirable, implement a small durable client-side queue for assessment edits.
3. Only later, consider full optional offline mode with project snapshots, app-shell caching, and conflict resolution.

This document mainly describes steps 2 and 3. It should not be interpreted as saying that #63 requires a full offline architecture.

## Conflict strategy

Do not start with CRDTs for rubric grades.

For rubric assessment cells, use domain-level conflict detection.

### Easy merges

The server can automatically merge commands when they affect different cells.

Examples:

- client A edits rubric cell 1;
- client B edits rubric cell 2;
- both sync later;
- both can be accepted.

### Same-cell conflicts

If two clients edit the same assessment cell from the same old base revision, the server should not silently overwrite.

Possible policies:

#### Option A: last write wins

Accept the later command and overwrite the previous value.

Pros:

- easiest implementation;
- minimal UI.

Cons:

- can silently lose grades;
- bad fit for high-value grading data;
- difficult to explain after the fact.

This should probably be avoided, or used only with a visible audit trail and very clear semantics.

#### Option B: conflict state

Reject or pause the stale command and return a conflict.

The client shows:

```txt
This assessment was changed elsewhere.

Server value:
  Good

Your local value:
  Very good

Choose:
  Keep server value
  Use my value
```

Pros:

- safest;
- explicit;
- good fit for grading.

Cons:

- requires conflict UI;
- more cases to test.

This is the recommended policy for same-cell grade conflicts.

#### Option C: field-level merge

If one client edits the grade and another edits the comment, merge both.

Pros:

- avoids unnecessary conflicts;
- intuitive if fields are independent.

Cons:

- requires precise command semantics;
- may still need conflict UI for same-field edits.

This is worth considering.

### Comments

Short comments can probably use the same conflict model as grades.

For longer free-text comments edited concurrently, conflicts become harder. However, CRDTs are still probably unnecessary unless the app supports simultaneous collaborative text editing.

If comments are important and long, a pragmatic approach is:

- detect same-comment conflicts;
- show both versions;
- let the user manually resolve.

## UI requirements

Offline support must be visible.

The UI should distinguish:

```txt
Saved locally
Syncing
Synced
Sync failed
Conflict
```

Avoid showing only "Saved" for a local-only edit. "Saved locally" is more honest.

Possible per-project status:

```txt
Offline available
Last synced: 2026-05-19 20:12
Unsynced changes: 3
Storage: persistent
```

Possible cell-level status:

```txt
✓ Synced
● Unsynced
↻ Syncing
⚠ Conflict
```

Possible global warning:

```txt
You have 3 unsynced grading changes. They are saved on this device but not yet on the server.
```

When export or finalization is requested, the app should either:

- block while unsynced changes exist; or
- allow it only with a strong warning.

Recommended default:

> Block final export/finalization if unsynced changes exist, unless the user explicitly exports a local/offline draft.

## Browser persistence and data-loss risks

Browser storage should be treated as durable enough for temporary offline work, but not as permanent archival storage.

By default, browser storage can be "best effort." Browsers can evict storage under pressure. For high-value grading data, request persistent storage:

```ts
const persisted = await navigator.storage?.persist?.();
```

Also expose the storage status somewhere, at least in a debug/settings area:

```txt
Offline storage: persistent
```

or:

```txt
Offline storage: best effort
```

The app should also provide a manual backup escape hatch:

```txt
Download unsynced changes as JSON
```

This is important. Even if browser eviction is rare for active sites, the cost of losing grades is high.

## Local backup format

A local backup should include enough information to recover manually or replay commands.

Example:

```json
{
  "format": "grading-offline-backup-v1",
  "exportedAt": "2026-05-19T18:12:00.000Z",
  "projectId": "p_123",
  "projectSlug": "final-project",
  "clientId": "client_abc",
  "baseProjectRevision": "rev_123",
  "unsyncedCommands": [
    {
      "id": "cmd_01H...",
      "kind": "setOrdinalAssessment",
      "submissionId": "sub_456",
      "rubricAssessmentId": "ra_123",
      "selectedLabel": "Good",
      "baseRevision": "rev_122",
      "createdAt": "2026-05-19T18:10:00.000Z"
    }
  ],
  "localAssessmentProjection": []
}
```

The backup is not the main sync mechanism. It is a disaster recovery mechanism.

## Library and approach audit

### Dexie

Dexie is the recommended first-choice library.

Dexie is a mature wrapper around IndexedDB. It provides:

- typed tables;
- schema declarations;
- indexes;
- transactions;
- migrations;
- promise-based API;
- React integration through live queries;
- cross-tab reactivity.

Why it fits this app:

- the app needs structured local data;
- assessment data needs indexes;
- outbox queries need to filter by project and status;
- Dexie does not force a new backend architecture;
- the sync protocol can remain app-specific and auditable.

Potential local schema:

```ts
import Dexie, { type Table } from "dexie";

export type LocalProject = {
  projectId: string;
  slug: string;
  name: string;
  serverRevision: string;
  downloadedAt: string;
};

export type LocalAssessment = {
  id: string;
  projectId: string;
  submissionId: string;
  rubricAssessmentId: string;
  type: "boolean" | "ordinal" | "numerical";
  valueJson: unknown;
  comment?: string;
  revision?: string;
  dirty: boolean;
  conflict: boolean;
  updatedAt: string;
};

export type OutboxCommand = {
  id: string;
  projectId: string;
  clientId: string;
  kind: string;
  payloadJson: unknown;
  baseRevision: string | null;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  error?: string;
};

class GradingLocalDb extends Dexie {
  projects!: Table<LocalProject, string>;
  assessments!: Table<LocalAssessment, string>;
  outbox!: Table<OutboxCommand, string>;

  constructor() {
    super("grading-local-db");

    this.version(1).stores({
      projects: "projectId, slug, downloadedAt",
      assessments:
        "id, projectId, submissionId, rubricAssessmentId, [projectId+submissionId], [projectId+rubricAssessmentId], dirty, conflict",
      outbox:
        "id, projectId, clientId, status, createdAt, [projectId+status]",
    });
  }
}

export const localDb = new GradingLocalDb();
```

Risks:

- you have to write sync yourself;
- IndexedDB migrations are another migration surface;
- IndexedDB debugging can be annoying;
- schema changes require care.

Assessment:

> Best complexity/reliability tradeoff for the first implementation.

### idb

`idb` is a lightweight promise wrapper for IndexedDB.

Pros:

- small;
- close to native IndexedDB;
- less framework-like than Dexie.

Cons:

- less convenient for complex indexed data;
- less ergonomic migrations;
- less built-in React story;
- more boilerplate.

Good fit if local storage remains tiny.

For this app, Dexie is likely preferable.

### idb-keyval

`idb-keyval` is a very small key-value wrapper over IndexedDB.

Pros:

- extremely simple;
- good for a few persisted values;
- useful for settings or small caches.

Cons:

- not enough for indexed assessment queries;
- not enough for a robust outbox;
- encourages storing giant blobs.

Good for:

```txt
clientId
lastOpenedProjectId
small settings
```

Not recommended as the main offline assessment store.

### TanStack Query persisted cache and persisted mutations

TanStack Query is useful for server-state caching and online request orchestration.

It can persist queries and mutations. It can help with retrying mutations after reconnect.

However, it should not be the canonical offline grading store.

Reasons:

- query cache is not a domain database;
- persisted mutations are API-call-oriented, not domain-log-oriented;
- local reads and progress calculations need structured local data;
- offline grading needs explicit durability and recovery;
- mutation resume has constraints and requires default mutation functions.

Good use:

- online fetching;
- background refresh;
- simple optimistic mutations;
- invalidation after sync.

Less good use:

- sole storage layer for grades;
- sole audit trail;
- sole outbox.

Recommended relationship:

```txt
TanStack Query:
  online server-state cache

Dexie:
  offline-capable local domain store and outbox
```

### Zustand / Redux / Jotai / React state

A client state manager is not a persistence mechanism.

These can still be useful for transient UI state:

- selected submission;
- drawer state;
- currently focused rubric;
- local filters;
- sort state.

But they should not be the offline store for assessment data.

If used, they should hydrate from Dexie and write durable changes to Dexie immediately.

### Workbox / Service Worker

Workbox is useful for offline app loading and request caching.

Use it for:

- app shell precaching;
- static assets;
- offline fallback page;
- maybe runtime caching of safe GET requests;
- maybe background sync as an enhancement.

Do not use it as the assessment data layer.

Important caveat:

Background Sync should not be the only sync mechanism. Sync should also happen:

- when the app starts;
- when `navigator.onLine` changes to true;
- when the user manually clicks retry;
- after a successful online edit;
- before export/finalization.

Service Worker behavior varies across browsers and conditions. Treat it as helpful, not as the sole reliability mechanism.

### PGlite

PGlite runs PostgreSQL in the browser using WASM.

Why it is tempting:

- the app already uses PostgreSQL on the server;
- SQL locally would be powerful;
- some query logic could feel familiar;
- local relational projections may be convenient.

Why not start there:

- heavier runtime;
- WASM loading and persistence complexity;
- more complicated migrations;
- still requires sync design;
- may encourage mirroring the server DB too closely;
- likely overkill for storing assessment edits.

PGlite may become interesting if:

- local queries become very complex;
- you want browser-side SQL for substantial offline workflows;
- the app evolves into a more serious local-first system;
- you want to experiment with a Postgres-like local replica.

Assessment:

> Interesting later, probably too heavy for the first offline assessment implementation.

### ElectricSQL

ElectricSQL provides Postgres-oriented sync through shapes and local clients.

Why it is interesting:

- strong fit with a PostgreSQL backend;
- good conceptual match for syncing subsets of data;
- avoids inventing some read-side sync infrastructure;
- useful for live-ish replicated data.

Important distinction:

- Electric can help sync reads/projections from Postgres;
- writes typically still go through your application API.

Why not start there:

- adds infrastructure and conceptual weight;
- the app may not need generalized sync;
- custom command sync is easier to audit for grades;
- conflict semantics still need domain-level decisions.

Good future use case:

- multi-device live project state;
- shared grading sessions;
- project data updated by multiple users;
- richer local-first behavior.

Assessment:

> Promising if offline/local-first becomes central, but a focused outbox is simpler first.

### RxDB

RxDB is a local-first database with observable queries, schemas, migrations, and sync capabilities.

Pros:

- mature local-first orientation;
- reactive queries;
- schema support;
- conflict handling concepts;
- custom sync possible;
- encryption/plugins ecosystem.

Cons:

- bigger framework;
- document-oriented model;
- more concepts to learn;
- may duplicate backend/domain structure awkwardly;
- heavier than needed for rubric cells.

Good fit if:

- offline mode becomes a core product feature;
- many entities need bidirectional sync;
- the app wants a local-first document DB architecture.

Assessment:

> Powerful, but probably too much machinery for the first version.

### PouchDB / CouchDB

PouchDB is a classic offline-first client database that syncs with CouchDB-compatible servers.

Pros:

- mature offline-first model;
- built-in replication;
- well-known revision/conflict approach;
- works offline by design.

Cons:

- wants a CouchDB-style backend;
- document/revision model may not fit the current PostgreSQL/Kysely architecture;
- adopting it would reshape the backend story;
- not ideal if PostgreSQL remains central.

Assessment:

> Good technology in the right ecosystem, but probably a poor fit here.

### Replicache

Replicache has a very appealing model for local-first apps:

- instant local writes;
- mutation queue;
- server reconciliation;
- offline support;
- conflict handling through app-defined mutators.

This is conceptually close to what the app needs.

However, Replicache is now in maintenance mode, with new development shifted to Zero.

Assessment:

> Architecturally relevant, but not a good default dependency for a new implementation today.

Replicache is still useful as inspiration:

- command/mutator model;
- local optimistic state;
- server reconciliation;
- idempotent mutations;
- explicit pull/push protocol.

### Zero

Zero is the successor direction associated with Replicache.

It may be worth watching, but it is not the obvious first choice for this app unless the app is deliberately moving toward a local-first sync platform.

Assessment:

> Watch, but do not block a practical offline implementation on it.

### LiveStore

LiveStore is an event-sourcing/local-first style framework.

Why it is interesting:

- event log model maps well to command/outbox thinking;
- local-first design;
- reactive UI potential;
- TypeScript-friendly direction.

Why not start there:

- younger ecosystem;
- parts of the documentation and ecosystem are still evolving;
- may be too experimental for high-value grading data;
- introduces a larger architectural shift.

Assessment:

> Interesting to monitor, but not the safest first implementation.

### Yjs / Automerge / CRDT libraries

CRDTs are designed for concurrent editing and automatic merging of shared data structures.

They are useful for:

- collaborative rich text;
- shared whiteboards;
- simultaneous editing;
- nested shared documents;
- peer-to-peer-ish collaborative structures.

They are not the right default for rubric grades.

For an assessment cell, the meaningful operation is usually:

```txt
set this rubric value to X
```

If two users set it to different values, automatic CRDT merging does not produce a meaningful grade. The app needs a domain decision.

Assessment:

> Avoid CRDTs for rubric values. Consider only for collaborative rich-text comments, and only if that becomes a real requirement.

### localStorage

Do not use `localStorage` for assessment data.

Problems:

- synchronous API;
- small quota;
- poor fit for structured/indexed data;
- easy to corrupt large JSON blobs;
- no transactions;
- bad for high-value offline data.

Acceptable use:

- small non-critical preferences;
- last selected project ID;
- UI settings.

Not acceptable:

- grades;
- comments;
- outbox;
- project snapshots.

### Cache API

Do not use the Cache API for assessment data.

The Cache API is for HTTP requests/responses. It is appropriate for assets and maybe safe GET responses, not domain state.

## Recommended phased implementation

### Phase 0: Immediate data-loss protection (#63)

Goal:

> Prevent silent loss of grading progress when the server is unavailable, without implementing a full offline mode.

This could include:

- clear failed-save detection;
- visible error state when a save fails;
- retry affordance;
- navigation/reload warning while unsaved or failed changes exist;
- possibly a minimal in-memory or local fallback for failed edits.

This phase is not the same as #64, but it should likely come first.

### Phase 1: Durable local queue for assessment edits

Goal:

> Assessment changes made while the app is open are saved locally if the server is temporarily unavailable, then retried later.

Scope:

- assessment edits stored locally;
- outbox commands stored locally;
- sync on reconnect/app open/manual retry;
- visible sync status;
- local backup export;
- block final export if unsynced changes exist.

This phase may not require full app-shell offline support yet.

### Phase 2: Safe optional offline grading mode

Goal:

> Users can grade offline for an already-opened/downloaded project, and changes are saved locally until synced.

Additional scope:

- project snapshot stored in IndexedDB;
- offline project availability state;
- explicit "available offline" or equivalent behavior;
- app can render grading screens from local project data;
- synchronization updates both local state and server state.

Implementation pieces:

```txt
client/offline/local-db.ts
client/offline/outbox.ts
client/offline/sync.ts
client/offline/storage-status.ts
client/offline/use-offline-project.ts
client/offline/use-sync-status.ts
```

Server pieces:

```txt
app/api/projects/[projectId]/sync-assessment-commands/route.ts
server/assessment-command-handler.ts
server/assessment-mutation-log-repository.ts
```

Tests:

- local command is persisted;
- local command updates local projection;
- failed sync leaves command pending/failed;
- retry does not duplicate server mutation;
- duplicate command ID is idempotent;
- stale base revision creates conflict;
- accepted command clears dirty state;
- local backup includes all pending commands.

### Phase 3: Conflict and audit hardening

Goal:

> Make same-cell conflicts safe and auditable.

Add:

- per-assessment revision;
- mutation log;
- conflict response type;
- conflict UI;
- manual resolution commands;
- audit/debug view if useful.

Conflict response sketch:

```ts
type SyncConflict = {
  commandId: string;
  projectId: string;
  entityId: string;
  kind: "sameAssessmentChanged";

  localValue: unknown;
  serverValue: unknown;

  localBaseRevision: string | null;
  currentServerRevision: string;
};
```

Resolution commands:

```ts
type ResolveAssessmentConflictCommand =
  | {
      kind: "keepServerAssessment";
      conflictId: string;
    }
  | {
      kind: "overwriteWithLocalAssessment";
      conflictId: string;
      value: unknown;
    };
```

### Phase 4: Broader offline support

Only after the previous phases are stable, consider:

- offline project selection from previously opened projects;
- offline comments;
- offline rubric browsing;
- offline progress dashboard;
- offline export draft;
- pre-download project for offline use;
- app-shell loading through Service Worker / Workbox.

Be careful with offline project/rubric editing. Changes to rubric structure can invalidate assessment commands. It is much safer to make rubric/project configuration online-only initially.

### Phase 5: Re-evaluate heavier local-first frameworks

If the custom Dexie/outbox approach becomes insufficient, re-evaluate:

- ElectricSQL;
- RxDB;
- PGlite;
- LiveStore;
- Zero.

Triggers for re-evaluation:

- multiple users need near-real-time sync;
- many entities need bidirectional sync;
- server-to-client patches become complex;
- local queries become SQL-like and hard to maintain;
- offline configuration editing becomes necessary;
- conflict handling becomes central and frequent.

## Suggested local Dexie tables

A concrete first schema could be:

```ts
type LocalProject = {
  projectId: string;
  slug: string;
  name: string;
  serverRevision: string;
  downloadedAt: string;
  lastOpenedAt: string;
  schemaVersion: number;
};

type LocalSubmission = {
  id: string;
  projectId: string;
  teamName: string;
  studentNames: string[];
  sortKey: string;
};

type LocalRubricAssessment = {
  id: string;
  projectId: string;
  questionId: string;
  rubricId: string;
  type: "boolean" | "ordinal" | "numerical";
  label: string;
  maxScore?: number;
  valuesJson?: unknown;
};

type LocalAssessment = {
  id: string;
  projectId: string;
  submissionId: string;
  rubricAssessmentId: string;
  type: "boolean" | "ordinal" | "numerical";
  valueJson: unknown;
  comment?: string;
  serverRevision?: string;
  localUpdatedAt: string;
  dirty: boolean;
  conflict: boolean;
};

type LocalOutboxCommand = {
  id: string;
  clientId: string;
  projectId: string;
  kind: string;
  entityId: string;
  payloadJson: unknown;
  baseRevision: string | null;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  error?: string;
};

type LocalSyncMetadata = {
  key: string;
  valueJson: unknown;
};
```

Possible indexes:

```ts
this.version(1).stores({
  projects: "projectId, slug, downloadedAt, lastOpenedAt",
  submissions: "id, projectId, sortKey, [projectId+sortKey]",
  rubricAssessments: "id, projectId, questionId, rubricId, type",
  assessments:
    "id, projectId, submissionId, rubricAssessmentId, [projectId+submissionId], [projectId+rubricAssessmentId], dirty, conflict",
  outbox:
    "id, projectId, clientId, status, createdAt, [projectId+status]",
  syncMetadata: "key",
});
```

## Command design

Prefer semantic commands over row patches.

Good:

```ts
type SetOrdinalAssessmentCommand = {
  id: string;
  kind: "setOrdinalAssessment";
  projectId: string;
  submissionId: string;
  rubricAssessmentId: string;
  selectedLabel: string | null;
  baseRevision: string | null;
  createdAt: string;
};
```

Less good:

```ts
type UpdateRowCommand = {
  table: string;
  rowId: string;
  patch: Record<string, unknown>;
};
```

Semantic commands are better because:

- they can be validated against the rubric type;
- they are easier to make idempotent;
- they are easier to audit;
- they are easier to reason about in conflicts;
- they avoid exposing internal DB schema to the client;
- they can survive server schema refactors better.

## Sync algorithm sketch

On assessment edit:

```txt
1. Build a typed command.
2. Validate command locally.
3. In one IndexedDB transaction:
   - append command to outbox;
   - update local assessment projection;
   - mark assessment dirty.
4. Update UI as "Saved locally".
5. Try sync if online.
```

On sync:

```txt
1. Read pending/failed outbox commands for project.
2. Mark batch as syncing.
3. POST commands to sync endpoint.
4. For accepted commands:
   - update local assessment projection from server patch;
   - clear dirty state where appropriate;
   - remove or mark command as accepted.
5. For conflicts:
   - mark local assessment as conflict;
   - keep local command/value available.
6. For rejected commands:
   - mark failed with reason.
7. Update project revision.
```

On app startup:

```txt
1. Open Dexie.
2. Check persistent storage status.
3. Load last opened project if available.
4. Show offline/sync status.
5. If online, refresh project snapshot and process outbox.
```

On reconnect:

```txt
1. Debounce connectivity event.
2. Process outbox.
3. Refresh affected project snapshots.
```

## Connectivity caveats

Do not rely too much on `navigator.onLine`.

It is useful as a hint, not as truth.

A better approach:

- use `navigator.onLine` to trigger attempts;
- treat actual fetch success/failure as the real signal;
- allow manual retry;
- show clear failure state.

## Data integrity rules

The offline layer should preserve these invariants:

- a command is either pending, syncing, accepted, failed, or conflicting;
- a command is never deleted before server acknowledgement, except through explicit local discard;
- duplicate command submission is safe;
- failed sync does not erase local edits;
- local backup includes all unsynced commands;
- export/finalization does not silently ignore unsynced commands;
- project IDs are always included in local records and commands;
- commands cannot be applied to the wrong project;
- server validates all commands as if the client were untrusted.

## Security and privacy

Offline storage means grading data may remain on the device.

Consider:

- warning users that offline data is stored locally;
- allowing users to remove offline data for a project;
- clearing local data on logout if appropriate;
- not storing unnecessary personal data locally;
- avoiding sensitive debug logs;
- possibly adding a "Delete local offline copy" action.

If the app later supports authentication and shared devices, local offline data becomes more sensitive.

## Testing strategy

### Unit tests

Test command construction and validation:

- valid boolean command;
- invalid boolean value;
- invalid ordinal label;
- invalid numerical score;
- command requires project ID;
- command requires rubric assessment ID.

Test conflict policy:

- different cells merge;
- same cell with same base revision conflicts;
- same command ID is idempotent;
- grade and comment may merge if policy allows.

### Integration tests

Use a test database for server sync endpoint:

- accepted command updates PostgreSQL;
- duplicate command is harmless;
- stale command returns conflict;
- invalid command is rejected;
- mixed batch returns accepted + rejected + conflicts;
- command cannot cross project boundaries.

### Browser/storage tests

Use Playwright where possible:

- create local assessment edit;
- reload page;
- edit is still present;
- simulate offline;
- edit assessment;
- reconnect;
- command syncs;
- duplicate retry does not duplicate;
- conflict UI appears.

### Migration tests

Since IndexedDB schema migrations are another source of risk:

- test opening v1 local DB with v2 code;
- test preserving outbox across migration;
- test preserving dirty assessments across migration;
- test failure behavior if migration cannot complete.

## Failure modes to explicitly handle

### Server unavailable

Expected behavior:

- local edits remain saved;
- outbox remains pending/failed;
- UI shows sync failure;
- retry is available.

### Browser tab closes during sync

Expected behavior:

- syncing commands should be recoverable;
- on next startup, stale `syncing` commands should go back to `pending` or be retried safely;
- server idempotency prevents duplicate application.

### Command accepted but response lost

Expected behavior:

- client retries command;
- server recognizes command ID;
- server returns already-accepted state;
- client clears local pending state.

### Project structure changed while offline

Example:

- rubric was edited on server;
- local client submits assessment for old rubric value.

Expected behavior:

- server rejects or conflicts command;
- UI explains that project structure changed;
- local backup remains available.

### Browser storage unavailable or private mode issues

Expected behavior:

- app detects storage initialization failure;
- offline support is disabled;
- user is warned before grading;
- app does not pretend edits are durable.

### Quota exceeded

Expected behavior:

- app catches write failure;
- user is warned immediately;
- app does not mark edit as saved locally;
- backup/export option is offered if possible.

## Open questions

- Should offline support be project-scoped only?
- Should users explicitly mark a project as "available offline"?
- Should opening a project online automatically store an offline copy?
- How many projects should be kept offline?
- Should old local project snapshots be automatically removed?
- Should offline storage be cleared on logout?
- Should rubric/project configuration be editable offline?
- Should comments and grades have different conflict policies?
- Should final export be blocked when unsynced changes exist?
- Should there be a visible audit trail in the UI?
- What is the expected multi-user grading model?
- Are multiple graders expected to edit the same submission?
- Are multiple graders expected to edit the same rubric cell?
- Should the server preserve every grade change or only final values?
- Should local backups be importable by the app?

## Decision

For #64, if optional offline grading mode is eventually implemented, use:

```txt
Dexie + IndexedDB + local assessment projection + mutation outbox + server sync endpoint.
```

Do not start with:

- CRDTs;
- PGlite;
- ElectricSQL;
- RxDB;
- PouchDB;
- Replicache;
- a full local mirror of the PostgreSQL schema;
- `localStorage` for grades;
- Cache API for grades.

The recommended approach is deliberately boring. That is a feature.

Assessment data is high-value, but the domain is not inherently a collaborative text-editing problem. A small, explicit, command-based sync layer should be easier to test, debug, and explain than a general-purpose local-first framework.

## Future reconsideration points

Reconsider ElectricSQL, RxDB, PGlite, LiveStore, or Zero if:

- offline mode becomes a primary product feature;
- multiple users need live collaboration;
- many project entities need bidirectional offline editing;
- the custom sync endpoint grows too complex;
- local query needs exceed what Dexie handles comfortably;
- server-driven patches become difficult to maintain;
- the app needs richer local-first semantics across the whole domain.

Until then, keep the architecture narrow:

```txt
Offline grading = local project snapshot + durable assessment command outbox.
```
