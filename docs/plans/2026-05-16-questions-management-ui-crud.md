# Questions Management UI CRUD

## Goal
Implement a dedicated Questions management experience at /questions for inspect, add, update, and delete of questions and rubrics, with safe destructive UX and Storybook coverage.

## Scope
- Full CRUD for question + rubric definitions.
- Add route at /questions and expose it from a renamed data navigation menu.
- Preserve DB cascade behavior for delete, guarded by explicit impact + typed confirmation.
- Favor small focused components/hooks and avoid monolithic UI logic.
- Prefer planned refactors over hacks where current structure is awkward, with review before medium/large refactors.

## Architecture Constraints
- Keep abstractions lightweight and readable.
- Keep data flow explicit:
  - QuestionsManagementClient: orchestration/page-level state only.
  - QuestionTable: presentational list + local filter state.
  - QuestionForm: draft editing + submit payload emission.
  - RubricEditorList: row-level helper UI only.
  - DeleteQuestionDialog: confirmation input only.
- Hooks allowed only when reuse is clear and they do not hide side effects.

## Plan
1. Extend DB question module with management reads, full upsert, pre-delete impact, and delete mutation with cache invalidation.
2. Add typed server actions for create/update/delete and impact lookup with normalized error states.
3. Add /questions route and focused client components/hooks.
4. Refactor import menu into broader data menu and add Questions navigation.
5. Add Storybook stories (CSF3 + play functions) for core states and destructive-flow interaction checks.
6. Add tests for DB mutation correctness and UI destructive-flow validation.

## Verification
1. pnpm run check --fix
2. pnpm run check-types
3. Targeted DB tests for questions mutations/cascade behavior
4. pnpm run storybook:build
5. Manual checks for CRUD flows, destructive confirmation, and updated navigation

## Risks
- Incorrect cache invalidation can cause stale UI.
- Delete cascade can remove assessments unexpectedly if confirmation UX is weak.
- Upsert type transitions across rubric subtype tables can regress without tests.

## Rollback
- Revert touched files in this change set.

## Progress
- [x] Plan drafted
- [x] Plan validated with user
- [x] DB layer extended (loadManagedQuestions, saveManagedQuestion, deleteManagedQuestion, getQuestionDeleteImpact)
- [x] Server actions implemented with typed state and cache invalidation
- [x] UI components built (QuestionTable, QuestionForm, RubricEditorList, DeleteQuestionDialog, QuestionsManagementClient)
- [x] Routes created (/app/questions/page.tsx, /app/questions/loading.tsx)
- [x] Navigation menu renamed to "Data" and linked to /questions
- [x] Storybook stories with CSF3 and interaction tests (delete confirmation gating)
- [x] Type consolidation: state reuses ImportState, error handling reuses toImportErrorState
- [x] TypeScript validation: pnpm run check-types ✓
- [x] Code formatting: pnpm run check --fix ✓
- [x] Storybook build: pnpm run storybook:build ✓
- [ ] DB tests for mutations, type transitions, cascade behavior
- [ ] Manual CRUD flow testing
- [ ] Manual destructive confirmation testing
- [ ] Manual navigation testing

## Completion Status
**Implementation Phase Complete**: All code validation gates passed. Type safety improved by consolidating action state with existing ImportState. Error handling unified with existing toImportErrorState pattern. Field-level error display with Material-UI error props. Ready for manual testing phase.

### Latest Enhancements
- **Material-UI Error Props**: Added `error` and `helperText` to all form inputs (Question id, Confirmation field, Rubric error section)
- **Field-Level Validation Display**: 
  - Question id field shows "Question id is required" or server validation errors
  - Confirmation field shows "Confirmation phrase does not match" when user enters incorrect phrase
  - Rubric id fields display errors like "Rubric ids must be unique" directly on the relevant TextField
- **Structured Validation State**: Replaced flat `errors: string[]` with `fieldErrors` + `formErrors` so the server reports exact fields and the UI binds those directly to `field.error`/`helperText`
- **Accessibility**: Fixed story play function to use `screen` instead of `within()` for Material-UI Dialog testing
