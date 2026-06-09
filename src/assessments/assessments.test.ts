import { expect, test, vi } from "vitest";
import { loadAssessmentCacheTags } from "./assessments.ts";

vi.mock("server-only", () => ({}));

test("loadAssessmentCacheTags declares the granular tag and the assessments:all fallback", () => {
	expect(loadAssessmentCacheTags("12", "q-1")).toEqual([
		"assessments:12:q-1",
		"assessments:all",
	]);
});
