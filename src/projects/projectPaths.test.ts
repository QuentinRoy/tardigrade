import { describe, expect, it } from "vitest";
import {
	projectAssessmentSubmissionPath,
	projectAssessmentSubmissionRubricPath,
	projectAssessmentsPath,
	projectResultsPath,
} from "./projectPaths.ts";

describe("project assessment routes", () => {
	const projectId = "proj_123";
	const projectSlug = "cs101";

	it("builds assessments root path", () => {
		expect(projectAssessmentsPath({ projectId, projectSlug })).toBe(
			"/projects/proj_123/cs101/assessments",
		);
	});

	it("builds assessments results path", () => {
		expect(projectResultsPath({ projectId, projectSlug })).toBe(
			"/projects/proj_123/cs101/assessments/results",
		);
	});

	it("builds submission overview path", () => {
		expect(
			projectAssessmentSubmissionPath({
				projectId,
				projectSlug,
				submissionId: "sub_42",
			}),
		).toBe("/projects/proj_123/cs101/assessments/submissions/sub_42");
	});

	it("builds submission rubric path and preserves rubric context", () => {
		expect(
			projectAssessmentSubmissionRubricPath({
				projectId,
				projectSlug,
				submissionId: "sub_42",
				rubricId: "rubric-7",
			}),
		).toBe(
			"/projects/proj_123/cs101/assessments/submissions/sub_42/rubrics/rubric-7",
		);
	});
});
