import { expect, test } from "vitest";
import {
	assessedCriterionCountsBySubmissionCacheTags,
	assessmentCompletionRowsCacheTags,
	criterionAssessmentsCountCacheTags,
} from "./loadAssessmentCompletion.ts";

test("assessedCriterionCountsBySubmissionCacheTags scopes invalidation to the given rubric", () => {
	expect(assessedCriterionCountsBySubmissionCacheTags("q-1")).toEqual([
		"submissions",
		"rubrics",
		"assessments:rubric:q-1",
		"assessments:all",
	]);
});

test("assessmentCompletionRowsCacheTags declares the coarse submission, rubric and assessment tags", () => {
	expect(assessmentCompletionRowsCacheTags()).toEqual([
		"submissions",
		"rubrics",
		"assessments",
	]);
});

test("criterionAssessmentsCountCacheTags declares the coarse assessment aggregate tag", () => {
	expect(criterionAssessmentsCountCacheTags()).toEqual(["assessments"]);
});
