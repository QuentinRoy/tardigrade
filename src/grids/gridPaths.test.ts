import { describe, expect, it } from "vitest";
import {
	gridGradesPath,
	gridGradeTargetPath,
	gridGradeTargetRubricPath,
	gridResultsPath,
} from "./gridPaths.ts";

describe("grid grading routes", () => {
	const gridId = "proj_123";
	const gridSlug = "cs101";

	it("builds grades root path", () => {
		expect(gridGradesPath({ gridId, gridSlug })).toBe(
			"/grids/proj_123/cs101/grades",
		);
	});

	it("builds results path at the grid root", () => {
		expect(gridResultsPath({ gridId, gridSlug })).toBe(
			"/grids/proj_123/cs101/results",
		);
	});

	it("builds grade target path", () => {
		expect(
			gridGradeTargetPath({
				gridId,
				gridSlug,
				targetId: "t-1",
				targetSlug: "alice-smith",
			}),
		).toBe("/grids/proj_123/cs101/grades/t-1/alice-smith");
	});

	it("builds grade target rubric path and preserves rubric context", () => {
		expect(
			gridGradeTargetRubricPath({
				gridId,
				gridSlug,
				targetId: "t-1",
				targetSlug: "alice-smith",
				rubricId: "rubric-7",
			}),
		).toBe("/grids/proj_123/cs101/grades/t-1/alice-smith/rubrics/rubric-7");
	});
});
