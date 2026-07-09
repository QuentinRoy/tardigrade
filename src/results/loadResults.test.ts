import { expect, test } from "vitest";
import { resultsCacheTags } from "./loadResults.ts";

test("resultsCacheTags declares the coarse rubric, submission and assessment tags", () => {
	expect(resultsCacheTags()).toEqual(["rubrics", "submissions", "assessments"]);
});
