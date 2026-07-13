import { expect, test } from "vitest";
import { resultsCacheTags } from "./loadResults.ts";

test("resultsCacheTags declares the coarse rubric, grade-target and grade tags", () => {
	expect(resultsCacheTags()).toEqual(["rubrics", "grade-targets", "grades"]);
});
