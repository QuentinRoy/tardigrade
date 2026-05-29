import { describe, expect, it } from "vitest";
import {
  projectAssessmentSubmissionPath,
  projectAssessmentSubmissionQuestionPath,
  projectAssessmentsPath,
  projectOverviewPath,
} from "./projectPaths";

describe("project assessment routes", () => {
	const projectId = "proj_123";
	const projectSlug = "cs101";

	it("builds assessments root path", () => {
		expect(projectAssessmentsPath(projectId, projectSlug)).toBe(
			"/projects/proj_123/cs101/assessments",
		);
	});

	it("builds assessments overview path", () => {
		expect(projectOverviewPath(projectId, projectSlug)).toBe(
			"/projects/proj_123/cs101/assessments/overview",
		);
	});

	it("builds submission overview path", () => {
		expect(
			projectAssessmentSubmissionPath(projectId, projectSlug, "sub_42"),
		).toBe("/projects/proj_123/cs101/assessments/submissions/sub_42");
	});

	it("builds submission question path and preserves question context", () => {
		expect(
			projectAssessmentSubmissionQuestionPath(
				projectId,
				projectSlug,
				"sub_42",
				"question-7",
			),
		).toBe(
			"/projects/proj_123/cs101/assessments/submissions/sub_42/questions/question-7",
		);
	});
});
