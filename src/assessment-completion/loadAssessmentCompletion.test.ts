import { expect, test } from "vitest";
import {
	assessedCriterionCountsBySubmissionCacheTags,
	assessmentCompletionRowsCacheTags,
	criterionAssessmentsCountCacheTags,
} from "./loadAssessmentCompletion.ts";

test("assessedCriterionCountsBySubmissionCacheTags scopes invalidation to the given question", () => {
	expect(assessedCriterionCountsBySubmissionCacheTags("q-1")).toEqual([
		"submissions",
		"questions",
		"assessments:question:q-1",
		"assessments:all",
	]);
});

test("assessmentCompletionRowsCacheTags declares the coarse submission, question and assessment tags", () => {
	expect(assessmentCompletionRowsCacheTags()).toEqual([
		"submissions",
		"questions",
		"assessments",
	]);
});

test("criterionAssessmentsCountCacheTags declares the coarse assessment aggregate tag", () => {
	expect(criterionAssessmentsCountCacheTags()).toEqual(["assessments"]);
});
