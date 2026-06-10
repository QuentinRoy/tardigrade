import { expect, test, vi } from "vitest";
import { loadAssessmentCacheTags } from "./assessments.ts";

vi.mock("server-only", () => ({}));

test("loadAssessmentCacheTags declares the granular tag and the assessments:all fallback for a single question", () => {
	expect(
		loadAssessmentCacheTags({ submissionId: "12", questionId: "q-1" }),
	).toEqual(["assessments:12:q-1", "assessments:all"]);
});

test("loadAssessmentCacheTags declares the submission-scoped tag and the assessments:all fallback for a whole-submission load", () => {
	expect(loadAssessmentCacheTags({ submissionId: "12" })).toEqual([
		"assessments:12",
		"assessments:all",
	]);
});
