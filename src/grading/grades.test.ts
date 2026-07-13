import { expect, test } from "vitest";
import { loadGradeCacheTags } from "./grades.ts";

test("loadGradeCacheTags declares the granular tag and the grades:all fallback for a single rubric", () => {
	expect(loadGradeCacheTags({ targetId: "12", rubricId: "q-1" })).toEqual([
		"grades:12:q-1",
		"grades:all",
	]);
});

test("loadGradeCacheTags declares the target-scoped tag and the grades:all fallback for a whole-target load", () => {
	expect(loadGradeCacheTags({ targetId: "12" })).toEqual([
		"grades:12",
		"grades:all",
	]);
});
