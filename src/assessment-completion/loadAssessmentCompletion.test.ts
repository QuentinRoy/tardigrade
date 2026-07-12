import { expect, test } from "vitest";
import {
	assessedCriterionCountsByTargetCacheTags,
	assessmentCompletionRowsCacheTags,
	criterionAssessmentsCountCacheTags,
} from "./loadAssessmentCompletion.ts";

test("assessedCriterionCountsByTargetCacheTags scopes invalidation to the given rubric", () => {
	expect(assessedCriterionCountsByTargetCacheTags("q-1")).toEqual([
		"grade-targets",
		"rubrics",
		"assessments:rubric:q-1",
		"assessments:all",
	]);
});

test("assessmentCompletionRowsCacheTags declares the coarse grade-target, rubric and assessment tags", () => {
	expect(assessmentCompletionRowsCacheTags()).toEqual([
		"grade-targets",
		"rubrics",
		"assessments",
	]);
});

test("criterionAssessmentsCountCacheTags declares the coarse assessment aggregate tag", () => {
	expect(criterionAssessmentsCountCacheTags()).toEqual(["assessments"]);
});
