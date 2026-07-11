import { expect, test } from "vitest";
import { loadAssessmentCacheTags } from "./assessments.ts";

test("loadAssessmentCacheTags declares the granular tag and the assessments:all fallback for a single rubric", () => {
	expect(loadAssessmentCacheTags({ targetId: "12", rubricId: "q-1" })).toEqual([
		"assessments:12:q-1",
		"assessments:all",
	]);
});

test("loadAssessmentCacheTags declares the target-scoped tag and the assessments:all fallback for a whole-target load", () => {
	expect(loadAssessmentCacheTags({ targetId: "12" })).toEqual([
		"assessments:12",
		"assessments:all",
	]);
});
