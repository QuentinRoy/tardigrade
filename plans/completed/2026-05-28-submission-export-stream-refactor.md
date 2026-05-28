# Submission Export Stream Refactor Plan (2026-05-28)

Status: Completed
Date: 2026-05-28
Resolution: Submission export now streams nested data rows from `src/export/submissionExport.ts`, formats CSV in `src/export/submissionExportCsv.ts`, and parses request options in a route-local helper. CSV headers, column order, and output semantics were preserved.
Follow-up: None

## Goal
Refactor submission CSV export so DB streaming and CSV serialization are separated without changing the CSV contract.

## Decisions Locked
- Keep exact same CSV header names and order.
- `createSubmissionExport` returns nested camelCase data rows, not CSV strings.
- `createCsvSubmissionExport` owns `csv-stringify` and returns `ReadableStream<Uint8Array>`.
- Request query parsing belongs to the route layer, not the CSV serializer.
- Header ordering and underscore key naming stay owned by the CSV projection layer only.
- Keep CSV schema tests and stream output coverage.

## Outcome
1. `src/export/submissionExport.ts`
- Streams submission rows from DB.
- Builds nested export rows and keeps submission boundary flush logic in one place.

2. `src/export/submissionExportCsv.ts`
- Builds headers and flat CSV records from nested export rows.
- Serializes typed values without query parsing or DB access.

3. Route layer
- `app/projects/[projectId]/[projectSlug]/export/submissions/route.ts` parses include query params with a small route-local helper.
- The route passes `ExportOptions` to `createCsvSubmissionExport`.
- Response filename and headers stay unchanged.

4. Tests
- `src/export/submissionExportCsv.test.ts` covers header order and record shaping.
- `src/export/submissionExport.test.ts` covers streaming assembly.
- `app/projects/[projectId]/[projectSlug]/export/submissions/exportOptions.test.ts` covers route option parsing.

5. Validation
- Focused export tests pass.
- No full repo check or typecheck run was required for this doc update.