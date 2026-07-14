import { expect, test } from "vitest";
import {
	gradeAggregateCacheTag,
	gradeCompletionForRubricCacheTag,
	gradeForGradeTargetCacheTag,
	gradeForGradeTargetRubricCacheTag,
	gradeImportCacheTag,
	gradeTargetListCacheTag,
	gridCacheTag,
	gridListCacheTag,
	rubricListCacheTag,
} from "./cacheTags.ts";

// The exact tag strings are pinned with inline snapshots: an unintended change
// to a tag's shape fails the test (a shape change silently breaks invalidation),
// while a deliberate change is a one-line `vitest -u`. `g-1`/`t-1`/`q-1` are
// representative public ids.
test("every tag shape", () => {
	const gridId = "g-1";
	expect({
		gridList: gridListCacheTag(),
		grid: gridCacheTag({ gridId }),
		rubricList: rubricListCacheTag({ gridId }),
		gradeTargetList: gradeTargetListCacheTag({ gridId }),
		gradeAggregate: gradeAggregateCacheTag({ gridId }),
		gradeImport: gradeImportCacheTag({ gridId }),
		gradeForGradeTarget: gradeForGradeTargetCacheTag({
			gridId,
			targetId: "t-1",
		}),
		gradeForGradeTargetRubric: gradeForGradeTargetRubricCacheTag({
			gridId,
			targetId: "t-1",
			rubricId: "q-1",
		}),
		gradeCompletionForRubric: gradeCompletionForRubricCacheTag({
			gridId,
			rubricId: "q-1",
		}),
	}).toMatchInlineSnapshot(`
		{
		  "gradeAggregate": "grids:g-1:grades",
		  "gradeCompletionForRubric": "grids:g-1:grades:rubric:q-1",
		  "gradeForGradeTarget": "grids:g-1:grades:target:t-1",
		  "gradeForGradeTargetRubric": "grids:g-1:grades:target:t-1:rubric:q-1",
		  "gradeImport": "grids:g-1:grades:all",
		  "gradeTargetList": "grids:g-1:grade-targets",
		  "grid": "grids:g-1",
		  "gridList": "grids",
		  "rubricList": "grids:g-1:rubrics",
		}
	`);
});

// The literal discriminators (`target:`, `rubric:`, `all`) exist so that
// author-chosen ids can never make two different tag shapes collide. Prove it
// with adversarial ids: a grade target or rubric literally named "all",
// "rubric", or "target" still can't alias the aggregate, import, or completion
// tags — the shapes stay distinct by construction, not by id convention.
test("adversarial ids cannot alias distinct tag shapes", () => {
	const gridId = "g-1";
	const tags = [
		gridListCacheTag(),
		gridCacheTag({ gridId }),
		rubricListCacheTag({ gridId }),
		gradeTargetListCacheTag({ gridId }),
		gradeAggregateCacheTag({ gridId }),
		gradeImportCacheTag({ gridId }),
		gradeForGradeTargetCacheTag({ gridId, targetId: "all" }),
		gradeForGradeTargetCacheTag({ gridId, targetId: "rubric" }),
		gradeForGradeTargetRubricCacheTag({
			gridId,
			targetId: "all",
			rubricId: "all",
		}),
		gradeCompletionForRubricCacheTag({ gridId, rubricId: "all" }),
		gradeCompletionForRubricCacheTag({ gridId, rubricId: "target" }),
	];

	expect(new Set(tags).size).toBe(tags.length);
});
