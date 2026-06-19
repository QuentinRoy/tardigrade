import { expect, test } from "vitest";
import {
	assessedRubricCountsBySubmissionCacheTags,
	assessmentCompletionBySubmissionCacheTags,
	assessmentCompletionSummaryCacheTags,
} from "./loadAssessmentCompletion.ts";

test("assessedRubricCountsBySubmissionCacheTags scopes invalidation to the given question", () => {
	expect(assessedRubricCountsBySubmissionCacheTags("q-1")).toEqual([
		"submissions",
		"questions",
		"assessments:question:q-1",
		"assessments:all",
	]);
});

test("assessmentCompletionBySubmissionCacheTags declares the coarse submission, question and assessment tags", () => {
	expect(assessmentCompletionBySubmissionCacheTags()).toEqual([
		"submissions",
		"questions",
		"assessments",
	]);
});

test("assessmentCompletionSummaryCacheTags declares the coarse submission, question and assessment tags", () => {
	expect(assessmentCompletionSummaryCacheTags()).toEqual([
		"submissions",
		"questions",
		"assessments",
	]);
});
