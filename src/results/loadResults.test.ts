import { expect, test } from "vitest";
import { resultsCacheTags } from "./loadResults.ts";

test("resultsCacheTags declares the coarse rubric, grade-target and grade tags, scoped to the grid", () => {
	expect(resultsCacheTags({ gridId: "g-1" })).toEqual([
		"grids:g-1:rubrics",
		"grids:g-1:grade-targets",
		"grids:g-1:grades",
	]);
});
