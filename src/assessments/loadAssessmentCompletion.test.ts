import { expect, test, vi } from "vitest";
import {
	assessedRubricCountsBySubmissionCacheTags,
	assessmentCompletionBySubmissionCacheTags,
	assessmentCompletionSummaryCacheTags,
} from "./loadAssessmentCompletion.ts";

vi.mock("server-only", () => ({}));

test("assessedRubricCountsBySubmissionCacheTags scopes invalidation to the given question", () => {
	expect(assessedRubricCountsBySubmissionCacheTags("q-1")).toEqual([
		"submissions",
		"questions",
		"assessments:question:q-1",
		"assessments:all",
		"questions:q-1",
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
