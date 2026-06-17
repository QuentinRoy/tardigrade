## Summary

<!-- Briefly describe what this PR changes and why. -->

## Related issue

<!-- Delete this section if there is no related issue.
Use `Fixes #...` or `Closes #...` when this PR completes the issue.
Use `Related to #...` for partial work or supporting documentation. -->

## Plan

<!-- For non-trivial code-change tasks, link the relevant plan file when one exists or explain why no plan was needed. Documentation-only changes may use "not applicable". -->

- Plan file:
- User validated plan: yes / explicit opt-out / not applicable

## Changes

<!-- List the main changes. Keep this focused on reviewer-relevant information. -->

## Validation

<!-- Adapt this checklist to the PR. Documentation-only PRs do not need code validation commands unless they touch executable examples, workflow files, or other checked artifacts. -->

- [ ] `pnpm run check --fix`
- [ ] `pnpm run check-types`
- [ ] Focused tests:
- [ ] Integration tests if DB/import/export/routing behavior changed:

## Risk review

<!-- Check or remove items that do not apply. Add notes for any non-trivial risk. -->

- [ ] No existing migration was modified
- [ ] Project isolation considered
- [ ] Data-loss/destructive behavior considered
- [ ] User-visible errors remain actionable
- [ ] Docs/import/export contracts updated if affected

## Labels (metadata)

<!-- Do not list labels in this PR body. Apply labels via GitHub metadata (UI or CLI), for example: `gh pr edit --add-label <label>`. Prefer existing labels and do not introduce new labels lightly. -->

## Notes

<!-- Add residual risks, follow-ups, or reviewer guidance. -->