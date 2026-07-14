import { expect, test } from "vitest";
import {
	criterionGradesCountCacheTags,
	gradeCompletionRowsCacheTags,
	gradedCriterionCountsByTargetCacheTags,
} from "./loadGradeCompletion.ts";

test("gradedCriterionCountsByTargetCacheTags scopes invalidation to the given grid and rubric", () => {
	expect(
		gradedCriterionCountsByTargetCacheTags({ gridId: "g-1", rubricId: "q-1" }),
	).toEqual([
		"grids:g-1:grade-targets",
		"grids:g-1:rubrics",
		"grids:g-1:grades:rubric:q-1",
		"grids:g-1:grades",
	]);
});

test("gradeCompletionRowsCacheTags declares the coarse grade-target, rubric and grade tags, scoped to the grid", () => {
	expect(gradeCompletionRowsCacheTags({ gridId: "g-1" })).toEqual([
		"grids:g-1:grade-targets",
		"grids:g-1:rubrics",
		"grids:g-1:grades",
	]);
});

test("criterionGradesCountCacheTags declares the coarse grade aggregate tag, scoped to the grid", () => {
	expect(criterionGradesCountCacheTags({ gridId: "g-1" })).toEqual([
		"grids:g-1:grades",
	]);
});
