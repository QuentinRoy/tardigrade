import { expect, test } from "vitest";
import { resultsCacheTags } from "./loadResults.ts";

test("resultsCacheTags declares the coarse question, submission and assessment tags", () => {
	expect(resultsCacheTags()).toEqual([
		"questions",
		"submissions",
		"assessments",
	]);
});
