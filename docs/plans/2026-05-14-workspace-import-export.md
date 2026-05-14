# Workspace Import/Export Plan

## Goal
Add a new full-workspace backup format using JSON that can:
- Export the complete database state required to fully restore the app workspace.
- Import/restore that backup by replacing all current data in one operation.
- Warn clearly that restore is destructive.

## Scope
- New export route for workspace JSON download.
- New import page/form/action for workspace JSON restore.
- New server-side workspace export builder and restore saver.
- Add menu entries in existing Import/Export menus.
- Add parsing/schema validation for workspace JSON payload.
- Add focused tests for schema/logic.



## Data Contract (import-aligned, minimal)
Top-level JSON object:
- `format`: literal string `workspace-v2`
- `exportedAt`: ISO date-time string
- `workspace` object containing:
  - `questions`: Array matching the import questions format (all optional fields present, with actual values used for defaults)
  - `students`: Array matching the import student format (as JSON, not CSV; all optional fields present, with actual values used for defaults)
  - `submissions`: Array of submission records, each with a `submissionType` ("individual" or "team"), referencing a student or team, and containing an array of `assessments`. Each assessment references a question and rubric, and contains the assessment value and type.

**Details:**
- `questions`: Each object matches the import question schema, e.g. `{ id, label, rubrics: [...] }` with all fields present (even if optional in import, always included here with their actual value or default).
- `students`: Each object matches the import student schema, e.g. `{ id, firstName, lastName, team? }` (all fields present, even if optional in import, always included here with their actual value or default).
- `submissions`: Each object includes a `submissionType` field ("individual" or "team"), references either a student (by `studentId`) or a team (by `teamName`), and contains an array of `assessments`. Each assessment includes a `questionId`, `rubricId`, `assessmentType` (e.g., "boolean", "ordinal", "numerical"), and the value. Only one of `studentId` or `teamName` is present per submission.

**Principles:**
- All references use natural keys (e.g., `id`, not DB row IDs).
- All optional fields are always present, using their actual value or the default.
- No internal DB fields, timestamps, or migration metadata.
- Structure is minimal and matches the import format for easy round-trip.

**Example:**
```json
{
  "format": "workspace-v2",
  "exportedAt": "2026-05-14T12:00:00Z",
  "workspace": {
    "questions": [
      {
        "id": "Q1",
        "label": "Question 1",
        "rubrics": [
          { "id": "R1", "label": "Correctness", "type": "boolean", "marks": 1, "falseMarks": 0, "description": "" },
          { "id": "R2", "label": "Style", "type": "ordinal", "marks": { "Good": 1, "Poor": 0 }, "description": "" },
          { "id": "R3", "label": "Score", "type": "numerical", "minScore": 0, "maxScore": 10, "minMarks": 0, "maxMarks": 10, "reversed": false, "description": "" }
        ]
      }
    ],
    "students": [
      { "id": "stu1", "firstName": "Alice", "lastName": "Smith", "team": "Team Alpha" },
      { "id": "stu2", "firstName": "Bob", "lastName": "Jones", "team": "Team Alpha" },
      { "id": "stu3", "firstName": "Charlie", "lastName": "Brown" }
    ],
    "submissions": [
      {
        "submissionType": "individual",
        "studentId": "stu1",
        "assessments": [
          { "questionId": "Q1", "rubricId": "R1", "assessmentType": "boolean", "passed": true },
          { "questionId": "Q1", "rubricId": "R2", "assessmentType": "ordinal", "selectedLabel": "Good" },
          { "questionId": "Q1", "rubricId": "R3", "assessmentType": "numerical", "score": 8 }
        ]
      },
      {
        "submissionType": "team",
        "teamName": "Team Alpha",
        "assessments": [
          { "questionId": "Q1", "rubricId": "R1", "assessmentType": "boolean", "passed": false },
          { "questionId": "Q1", "rubricId": "R2", "assessmentType": "ordinal", "selectedLabel": "Poor" },
          { "questionId": "Q1", "rubricId": "R3", "assessmentType": "numerical", "score": 5 }
        ]
      },
      {
        "submissionType": "individual",
        "studentId": "stu3",
        "assessments": [
          { "questionId": "Q1", "rubricId": "R1", "assessmentType": "boolean", "passed": true },
          { "questionId": "Q1", "rubricId": "R2", "assessmentType": "ordinal", "selectedLabel": "Good" },
          { "questionId": "Q1", "rubricId": "R3", "assessmentType": "numerical", "score": 10 }
        ]
      }
    ]
  }
}
```

## UX Changes
- Export menu: add `Download Workspace JSON` action.
- Import menu: add `Restore Workspace` entry to a new page.
- Restore page/form:
  - Uses text/file-drop JSON input (same style as existing import forms).
  - Shows explicit destructive warning in description/help.
  - Requires a confirmation phrase (proposed: `RESTORE`) before submit.

## Implementation Steps
1. Add `src/export/workspaceExport.ts` to query all required tables and return typed payload.
2. Add route `app/export/workspace/route.ts` returning pretty JSON attachment with deterministic filename.
3. Add `src/import/parseWorkspace.ts` + Zod schema for `workspace-v1` payload.
4. Add `src/import/saveWorkspace.ts` with transactional wipe + restore.
5. Add `src/import/workspaceImportAction.ts` and new form component/page.
6. Add menu links in `src/export/ExportCsvMenu.tsx` and `src/import/ImportMenu.tsx`.
7. Add tests for payload parsing and restore invariants where practical.
8. Run formatting/types/tests.

## Validation Checklist
- `pnpm run check --fix`
- `pnpm run check-types`
- Focused tests for touched areas (likely import/export parser tests)

## Risks
- FK order mistakes during destructive restore.
- Numeric type handling differences (`number` vs DB numeric parser behavior).
- Backward compatibility for future versions; addressed by explicit `format` version.

## Rollback Plan
- Revert feature branch changes.
- Existing CSV import/export flows remain unchanged.

## Progress
- [x] Context discovery and impact analysis.
- [ ] User validation of this plan.
- [ ] Implementation.
- [ ] Verification and final summary.
