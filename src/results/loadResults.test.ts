import { expect, test } from "vitest";
import { resultsCacheTags } from "./loadResults.ts";

test("resultsCacheTags declares the coarse rubric, grade-target and assessment tags", () => {
	expect(resultsCacheTags()).toEqual([
		"rubrics",
		"grade-targets",
		"assessments",
	]);
});
