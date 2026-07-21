import { expect, test } from "vitest";
import { loadGradeCacheTags } from "./grades.ts";

test("loadGradeCacheTags declares the target-scoped tag and the grid-wide grades tag", () => {
	expect(loadGradeCacheTags({ gridId: "g-1", targetId: "12" })).toEqual([
		"grids:g-1:grades:target:12",
		"grids:g-1:grades",
	]);
});
