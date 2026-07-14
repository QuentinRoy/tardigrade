import { expect, test } from "vitest";
import { loadGradeCacheTags } from "./grades.ts";

test("loadGradeCacheTags declares the granular tag and the grades:all fallback for a single rubric", () => {
	expect(
		loadGradeCacheTags({ gridId: "g-1", targetId: "12", rubricId: "q-1" }),
	).toEqual(["grids:g-1:grades:target:12:rubric:q-1", "grids:g-1:grades:all"]);
});

test("loadGradeCacheTags declares the target-scoped tag and the grades:all fallback for a whole-target load", () => {
	expect(loadGradeCacheTags({ gridId: "g-1", targetId: "12" })).toEqual([
		"grids:g-1:grades:target:12",
		"grids:g-1:grades:all",
	]);
});
