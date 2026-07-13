import { expect, test } from "vitest";
import {
	criterionGradesCountCacheTags,
	gradeCompletionRowsCacheTags,
	gradedCriterionCountsByTargetCacheTags,
} from "./loadGradeCompletion.ts";

test("gradedCriterionCountsByTargetCacheTags scopes invalidation to the given rubric", () => {
	expect(gradedCriterionCountsByTargetCacheTags("q-1")).toEqual([
		"grade-targets",
		"rubrics",
		"grades:rubric:q-1",
		"grades:all",
	]);
});

test("gradeCompletionRowsCacheTags declares the coarse grade-target, rubric and grade tags", () => {
	expect(gradeCompletionRowsCacheTags()).toEqual([
		"grade-targets",
		"rubrics",
		"grades",
	]);
});

test("criterionGradesCountCacheTags declares the coarse grade aggregate tag", () => {
	expect(criterionGradesCountCacheTags()).toEqual(["grades"]);
});
