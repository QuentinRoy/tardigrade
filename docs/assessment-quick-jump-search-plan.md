# Assessment Quick Jump Search Plan

## Goal

Enable graders to quickly move to a target submission while grading, using a search bar that supports:

- Team lookup by team name.
- Team lookup by student name (student belongs to that team).
- Fast navigation in both assessment modes:
  - Question-by-question mode keeps current question and switches submission.
  - Submission-overview mode switches submission overview page.

## Decisions Locked (Current)

- Search implementation: client-side (Fuse.js) for now.
- UI shell: fullscreen quick-jump dialog, opened by keyboard shortcut and lookup button.
- Searchable fields: team name, student names, team member names. Do not search submission id.
- Result list emphasis: display progress clearly in each result row; do not pin recent/visited submissions.
- Query persistence: disabled (do not persist between openings/routes).
- Typo tolerance: enabled in MVP (via Fuse.js threshold tuning).
- Decision update: progress is preferred over a simple completed badge.

## UX Fixes Requested (May 13)

- Add a clearly visible exit control in the lookup screen (not only keyboard escape).
- On open, search input must be preselected so typing replaces existing text immediately.
- Default highlighted row behavior must be corrected:
  - blue highlight should not appear on an arbitrary first row,
  - highlight should match explicit selection semantics.
- One-character queries should return results (remove current 2-character minimum behavior).

## UX Clarifications Locked (May 13)

- Default highlighted row on open: first search result.
- Visible exit control: top-right close icon.
- Input behavior on open: focus and select all text (typing replaces current content).
- One-character search: enabled (`minMatchCharLength = 1`).

## Implementation Status (Live)

- Phase 1: completed
  - Done: `loadSubmissions` now enriches team submissions with team member names.
  - Done: submission payload now includes search-oriented metadata (`displayLabel`, `memberNames`, `searchKeys`).
  - Done: Fuse.js dependency installed.
  - Done: shared quick-jump search utility implemented in `src/submissions/quickJumpSearch.ts`.
  - Done: tests added for team-member lookup, typo tolerance, and internal-id exclusion.
- Phase 2: completed
  - Done: fullscreen quick-jump dialog component added.
  - Done: lookup button added in both assessment modes.
  - Done: keyboard shortcut (`Cmd/Ctrl+K`) opens quick jump in both assessment modes.
  - Done: server-side cached progress maps loaded and passed to quick-jump UI:
    - question mode uses rubric progress per submission for current question.
    - submission mode uses question progress per submission.
  - Done: quick-jump result rows now display progress (`completed / total`).
  - Done: visible close/exit icon added in lookup header.
  - Done: search input focus+select behavior on open.
  - Done: highlight semantics locked to first search result on open.
  - Done: one-character search support enabled.
- Phase 3: completed
  - Done: match reason tracking added to search results.
  - Done: match reason displayed in result rows (e.g., "matched student: Alice Martin", "matched team: Alpha Team").
  - Done: row highlight styling refined to use softer `action.hover` instead of strong blue.
  - Done: enhanced state messaging:
    - empty query shows prompt: "Type to search by team or student name (supports partial matches)"
    - no results shows: "No matching submissions found. Try a different search term."
  - Done: tests added for match reason generation.
- Phase 4: deferred

## Current State (What We Have)

- Assessment has two active modes:
  - By question: `/assessments/submissions/:submissionId/questions/:questionId`
  - By submission: `/assessments/submissions/:submissionId`
- The grading client already has previous/next submission navigation.
- Submission labels currently expose only:
  - `team` submissions: `teamName`
  - `individual` submissions: `studentName`
- Team member names are not currently included in submission payloads, so searching a team by one of its students is not yet possible.

## Functional Requirements

- Search input visible in both:
  - Question grading screen.
  - Submission overview screen.
- Matching should include:
  - Team name.
  - Individual student full name.
  - Student names within team submissions.
- Selecting a result should navigate to:
  - Question mode: `/assessments/submissions/:matchedSubmissionId/questions/:currentQuestionId`
  - Submission mode: `/assessments/submissions/:matchedSubmissionId`
- Keyboard support:
  - Focus search quickly.
  - Arrow up/down to select results.
  - Enter to navigate.
  - Escape to close suggestions.

## Behavior By Assessment Mode

### Mode A: Assess by question

- Context: grader is on one question and iterates submissions.
- Quick-jump keeps `questionId` and changes `submissionId`.
- Best placement: in `SubmissionAssessmentClient`, near existing Previous/Next submission controls.

### Mode B: Assess by submission

- Context: grader reviews all questions for one submission.
- Quick-jump changes `submissionId` and stays on overview route.
- Best placement: in `SubmissionOverviewAssessmentClient`, near existing Previous/Next submission controls.

Shared expectation for both modes:

- Same matching logic, same ranking logic, same result item UI.
- Same keyboard behavior.
- Progress is shown in results, with contextual meaning by mode:
  - Question mode: rubric progress for current question (`completedRubrics / totalRubrics`).
  - Submission mode: question progress for submission overview (`completedQuestions / totalQuestions`).

## Non-Functional Requirements

- Search should feel instant for typical class sizes.
- Results should be deterministic and stable.
- No added complexity in grading save flow.
- Should work on desktop and mobile.
- Search data loading must not block grading UI interaction.
- Search data should be cached and reused so route changes do not force full reload each time.

## Data Shape Needed

Introduce a search-oriented submission payload on the grading page:

- `id`
- `type`
- `displayLabel` (existing label logic)
- `searchKeys: string[]` including normalized strings for:
  - Team name (for team submissions)
  - Individual student name (for individual submissions)
  - Team member student names (for team submissions)

Example:

- Team submission `Alpha Team` with students `Alice Martin`, `Bob Lee`
- `displayLabel = "Alpha Team"`
- `searchKeys = ["alpha team", "alice martin", "bob lee"]`

## Search Engine Choice

### Recommendation: Fuse.js for MVP and medium datasets

- Use Fuse.js on the client for fuzzy matching and typo tolerance.
- Keep deterministic business boosts on top of Fuse score (exact/prefix rules).
- This gives better relevance than plain `includes` while staying simple to ship.
- Do not index submission id because it is internal-only.

Suggested dependency:

- `fuse.js`

Suggested indexed fields:

- `displayLabel` (team name or individual student label)
- `memberNames` (team member names for team submissions)

Suggested Fuse options (starting point):

- `keys: ["displayLabel", "memberNames"]`
- `threshold: 0.3` (lower is stricter)
- `ignoreLocation: true`
- `minMatchCharLength: 1`
- `shouldSort: true`
- `includeScore: true`

Note after UX feedback:

- one-character search is enabled in implementation.

## Option 1: Client-Side Search (Fastest MVP)

### How it works

- Extend `loadSubmissions` to include team-member names for team submissions.
- Pass enriched submission list to both:
  - `SubmissionAssessmentClient` (question mode)
  - `SubmissionOverviewAssessmentClient` (submission mode)
- Add a local search component that filters the in-memory submissions array.
- Open a fullscreen dialog for lookup:
  - Keyboard shortcut (for example `Cmd+K`/`Ctrl+K`)
  - Lookup button near existing navigation controls.

### Loading and caching constraints

- Do not block initial rubric render on search-only metadata.
- Reuse cached submissions payload from existing data loaders (`loadSubmissions` cache tags/life).
- Keep Fuse index creation in-memory and memoized in client components.
- Avoid refetching on every page transition by using the already server-provided submissions list for the page.

### Matching strategy

- Normalize user query (trim and collapse spaces).
- Run Fuse.js search across label and member names.
- Apply deterministic boost layer after Fuse score:
  1. Exact label match.
  2. Label prefix match.
  3. Exact member/student match.
  4. Member/student prefix match.
- Sort by combined score, then label ascending for stable ties.

### Pros

- Minimal backend changes.
- Instant interaction once page is loaded.
- Easy to iterate on UX.
- Aligns with current architecture and cache model.

### Cons

- Payload grows with class size.
- Not ideal for very large cohorts.

## Option 2: Server-Side Search Endpoint (Scalable)

### How it works

- Add search route (for example `app/assessments/search/route.ts`).
- Query parameters: `q`, `mode`, optional `questionId`, optional `limit`.
- Route performs DB query against team and student names.
- Returns top ranked matches with submission ids and labels.

### Matching strategy options

- Basic `ILIKE` and tokenized query.
- Add PostgreSQL trigram (`pg_trgm`) for fuzzy matching if needed.
- If full parity with client behavior is required, consider server-side Fuse equivalent logic in app code over a prefiltered candidate set.

### Pros

- Small client payload.
- Better scalability.
- Centralized ranking logic.

### Cons

- More implementation complexity.
- Request/response latency to tune.

## Option 3: Hybrid (Recommended Target)

### How it works

- Start with Option 1 behavior for immediate UX.
- Add server endpoint behind feature flag when submission count exceeds threshold (for example 300).
- UI remains identical; data source switches from local to remote.

### Pros

- Fast delivery now.
- Clear upgrade path.
- Low risk migration.

### Cons

- Slightly more architecture to maintain.

## Query and Join Details

To support team lookup by student name, submission loading must include team members:

- Current schema includes `studentToTeam` join table.
- For team submissions:
  - `submission.teamId -> team.id`
  - `team.id -> studentToTeam.teamId -> student.id`
- Aggregate student names by submission id.

Kysely-level approach:

1. Fetch base submissions with left joins to direct student/team label.
2. Fetch team-member rows for team submissions in a second query.
3. Build `Map<submissionId, memberNames[]>` in memory.
4. Derive `searchKeys` per submission.

This two-query pattern is usually simpler and easier to maintain than a single large grouped SQL query.

## UX Options for the Search Control

### UX A: Inline Autocomplete in grading panel (recommended)

- Place under Current submission card and above Previous/Next buttons in both modes.
- MUI `Autocomplete` or `TextField + Popper` custom list.
- Shows submission label and secondary match reason (for example "matched student: Alice Martin").

### UX A+B Mix (selected)

- Trigger from an inline lookup button in the grading panel.
- Open a fullscreen search dialog (desktop modal-like, mobile full-screen).
- Preserve the same result item rendering and keyboard behavior across both assessment modes.

### UX B: Command palette modal

- Trigger via keyboard shortcut.
- Full-screen dialog on mobile, centered modal on desktop.
- Better for very long lists.

### UX C: Left drawer submission navigator

- Persistent searchable list in a drawer.
- Best if graders frequently jump non-linearly.
- More layout impact and engineering effort.

## Ranking and Relevance Rules

Use a hybrid relevance model:

- Base relevance from Fuse score.
- Add explicit business boosts to avoid surprising results:
  - +100 exact label match
  - +80 label startsWith query
  - +50 exact member/student match
  - +35 member/student startsWith query

Example combined scoring:

- `combined = (1 - fuseScore) * 100 + businessBoost`

Sort by `combined` descending, then label ascending.

Progress visibility rule:

- Do not boost or pin visited/recent items.
- Clearly display progress in results (for example `3/7` or `7/7`).
- Completed state can still be derived visually from progress (for example when completed equals total).

## Performance and Limits

- Debounce input by 100-150ms.
- Result cap: 10-20 entries.
- For client-side mode, precompute normalized search keys once.
- For server-side mode, add indexes:
  - Team name index.
  - Student name composite index (familyName, firstName) and/or generated full-name index.
  - Trigram index if fuzzy mode is enabled.

## Implementation Plan (Phased)

## Phase 0: Design and API contract

- Decide Option 1 vs 2 vs 3.
- Lock result item shape used by UI.
- Lock Fuse.js config defaults and acceptable tuning range (`threshold`, `minMatchCharLength`).
- Lock fullscreen interaction model (shortcut + lookup button).

Deliverable: short ADR in docs.

## Phase 1: Data enrichment

- Extend submission loading to include member names for team submissions.
- Add unit tests for enriched submission mapping.

Deliverable: `Submission` (or dedicated `SubmissionSearchItem`) includes search metadata.

## Phase 2: UI quick jump

- Add search input and result list to:
  - `SubmissionAssessmentClient` (question mode)
  - `SubmissionOverviewAssessmentClient` (submission mode)
- Add shared search utility wrapping Fuse.js initialization and query execution.
- Implement keyboard and pointer interactions.
- Navigate rules:
  - Question mode preserves current question id.
  - Submission mode navigates to selected submission overview.
- Use fullscreen dialog presentation in both modes.
- Do not persist query when dialog closes or route changes.
- Render contextual progress per result row:
  - Question mode shows rubric progress for current question.
  - Submission mode shows question progress for current submission overview.

Deliverable: functional in-page quick jump in both assessment modes.

## Phase 3: Relevance and polish

- Add scoring/ranking utilities.
- Show match reason in UI.
- Show progress prominently in each result row.
- Add empty/loading/error states.

Deliverable: predictable and polished search.

## Phase 4 (optional): Server search path

- Add search endpoint.
- Add threshold-based switch from local to remote.
- Add DB indexes and measure latency.

Deliverable: scalable path for large cohorts.

## Testing Plan

- Unit tests:
  - Query normalization.
  - Fuse.js matching and combined ranking.
  - Team student lookup behavior.
  - Typo tolerance cases (for example `alce` -> `Alice`).
- Integration tests:
  - Question mode: selecting result navigates to expected submission/question URL.
  - Submission mode: selecting result navigates to expected submission overview URL.
  - Keyboard interactions.
- Performance checks:
  - Time to first result under expected dataset sizes.

## Rollout Strategy

- Feature flag the search bar (`assessmentQuickJumpSearch`).
- Enable by default in local/staging.
- Monitor user feedback on relevance quality.

## Risks and Mitigations

- Risk: ambiguous names produce noisy results.
  - Mitigation: match reason and deterministic ranking.
- Risk: large class lists slow client-side filtering.
  - Mitigation: hybrid/server mode threshold.
- Risk: schema assumptions for team membership drift.
  - Mitigation: repository tests against `studentToTeam` mapping.

## Recommended Path

- Implement Option 1 now for speed.
- Structure code so Option 2 can be plugged in later without changing UI contract.
- Adopt Option 3 hybrid only if real dataset size or latency requires it.

## Clarification: Typo Tolerance in MVP

What this means:

- If grader types a slightly misspelled name (for example `alce` for `Alice`), should results still find the right submission?

Decision for this plan:

- Yes, enable typo tolerance in MVP with a conservative Fuse threshold (start around `0.3`) to avoid noisy matches.

## Open Decisions

- None for MVP scope after clarification pass.
