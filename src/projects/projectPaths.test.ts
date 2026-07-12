import { describe, expect, it } from "vitest";
import {
	projectGradesPath,
	projectGradeTargetPath,
	projectGradeTargetRubricPath,
	projectResultsPath,
} from "./projectPaths.ts";

describe("project grading routes", () => {
	const projectId = "proj_123";
	const projectSlug = "cs101";

	it("builds grades root path", () => {
		expect(projectGradesPath({ projectId, projectSlug })).toBe(
			"/projects/proj_123/cs101/grades",
		);
	});

	it("builds results path at the grid root", () => {
		expect(projectResultsPath({ projectId, projectSlug })).toBe(
			"/projects/proj_123/cs101/results",
		);
	});

	it("builds grade target path", () => {
		expect(
			projectGradeTargetPath({
				projectId,
				projectSlug,
				targetId: "t-1",
				targetSlug: "alice-smith",
			}),
		).toBe("/projects/proj_123/cs101/grades/t-1/alice-smith");
	});

	it("builds grade target rubric path and preserves rubric context", () => {
		expect(
			projectGradeTargetRubricPath({
				projectId,
				projectSlug,
				targetId: "t-1",
				targetSlug: "alice-smith",
				rubricId: "rubric-7",
			}),
		).toBe("/projects/proj_123/cs101/grades/t-1/alice-smith/rubrics/rubric-7");
	});
});
