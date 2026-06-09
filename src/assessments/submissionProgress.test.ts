import { expect, test, vi } from "vitest";
import {
	submissionOverviewProgressCacheTags,
	submissionQuestionProgressCacheTags,
} from "./submissionProgress.ts";

vi.mock("server-only", () => ({}));

test("submissionQuestionProgressCacheTags scopes invalidation to the given question", () => {
	expect(submissionQuestionProgressCacheTags("q-1")).toEqual([
		"submissions",
		"questions",
		"assessments:question:q-1",
		"assessments:all",
		"questions:q-1",
	]);
});

test("submissionOverviewProgressCacheTags declares the coarse submission, question and assessment tags", () => {
	expect(submissionOverviewProgressCacheTags()).toEqual([
		"submissions",
		"questions",
		"assessments",
	]);
});
