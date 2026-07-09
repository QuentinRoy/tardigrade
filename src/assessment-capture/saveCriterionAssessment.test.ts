import { describe, expect, it, vi } from "vitest";
import { saveCriterionAssessment } from "./saveCriterionAssessment.ts";

const errorContext = {
	projectId: "project-1",
	projectSlug: "project-slug",
	submissionId: "submission-1",
	questionId: "question-1",
};

describe("saveCriterionAssessment", () => {
	it("returns success when the server action succeeds", async () => {
		const saveAssessment = vi.fn().mockResolvedValueOnce({ success: true });

		const result = await saveCriterionAssessment({
			saveAssessment,
			submissionId: "submission-1",
			questionId: "question-1",
			assessment: { criterionId: "criterion-1", kind: "check", passed: true },
			errorContext,
		});

		expect(result).toEqual({ success: true });
	});

	it("returns the server action's failure message unchanged", async () => {
		const saveAssessment = vi
			.fn()
			.mockResolvedValueOnce({ success: false, error: "criterion changed" });

		const result = await saveCriterionAssessment({
			saveAssessment,
			submissionId: "submission-1",
			questionId: "question-1",
			assessment: { criterionId: "criterion-1", kind: "check", passed: true },
			errorContext,
		});

		expect(result).toEqual({
			success: false,
			error: { ...errorContext, message: "criterion changed" },
		});
	});

	it("maps a thrown/rejected server action call to an unreachable failure instead of leaving the save pending forever", async () => {
		const saveAssessment = vi
			.fn()
			.mockRejectedValueOnce(new Error("fetch failed"));

		const result = await saveCriterionAssessment({
			saveAssessment,
			submissionId: "submission-1",
			questionId: "question-1",
			assessment: { criterionId: "criterion-1", kind: "check", passed: true },
			errorContext,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toMatch(/connection|reach/i);
		}
	});
});
