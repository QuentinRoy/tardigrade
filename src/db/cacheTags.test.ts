import { expect, test } from "vitest";
import {
	allGradesTag,
	allGridsTag,
	allRubricsTag,
	allTargetGradesTag,
	allTargetsTag,
	gradeCompletionByRubricTag,
	gridTag,
} from "./cacheTags.ts";

// The exact tag strings are pinned with inline snapshots: an unintended change
// to a tag's shape fails the test (a shape change silently breaks invalidation),
// while a deliberate change is a one-line `vitest -u`. `g-1`/`t-1`/`q-1` are
// representative public ids.
test("every tag shape", () => {
	const gridId = "g-1";
	expect({
		allGrids: allGridsTag(),
		grid: gridTag({ gridId }),
		allRubrics: allRubricsTag({ gridId }),
		allTargets: allTargetsTag({ gridId }),
		allGrades: allGradesTag({ gridId }),
		allTargetGrades: allTargetGradesTag({ gridId, targetId: "t-1" }),
		rubricCompletion: gradeCompletionByRubricTag({ gridId, rubricId: "q-1" }),
	}).toMatchInlineSnapshot(`
		{
		  "allGrades": "grids:g-1:grades",
		  "allGrids": "grids",
		  "allRubrics": "grids:g-1:rubrics",
		  "allTargetGrades": "grids:g-1:grades:target:t-1",
		  "allTargets": "grids:g-1:grade-targets",
		  "grid": "grids:g-1",
		  "rubricCompletion": "grids:g-1:grades:rubric:q-1",
		}
	`);
});

// The literal discriminators (`target:`, `rubric:`, `all`) keep tag shapes
// distinct without relying on id formatting conventions. Prove it with
// adversarial ids: a grade target or rubric literally named "all",
// "rubric", or "target" still can't alias the aggregate, import, or completion
// tags — the shapes stay distinct by construction, not by id convention.
test("adversarial ids cannot alias distinct tag shapes", () => {
	const gridId = "g-1";
	const tags = [
		allGridsTag(),
		gridTag({ gridId }),
		allRubricsTag({ gridId }),
		allTargetsTag({ gridId }),
		allGradesTag({ gridId }),
		allTargetGradesTag({ gridId, targetId: "all" }),
		allTargetGradesTag({ gridId, targetId: "rubric" }),
		gradeCompletionByRubricTag({ gridId, rubricId: "all" }),
		gradeCompletionByRubricTag({ gridId, rubricId: "target" }),
	];

	expect(new Set(tags).size).toBe(tags.length);
});
