import { describe, expect, it, vi } from "vitest";
import { trySaveCriterionGrade } from "./trySaveCriterionGrade.ts";

const errorContext = {
	gridId: "grid-1",
	gridSlug: "grid-slug",
	targetId: "target-1",
	targetSlug: "target-slug",
	rubricId: "rubric-1",
};

describe("trySaveCriterionGrade", () => {
	it("returns success when the server action succeeds", async () => {
		const saveCriterionGrade = vi.fn().mockResolvedValueOnce({ success: true });

		const result = await trySaveCriterionGrade({
			saveCriterionGrade,
			gridId: "grid-1",
			targetId: "target-1",
			rubricId: "rubric-1",
			grade: { criterionId: "criterion-1", kind: "check", passed: true },
			errorContext,
		});

		expect(result).toEqual({ success: true });
	});

	it("returns the server action's failure message unchanged", async () => {
		const saveCriterionGrade = vi
			.fn()
			.mockResolvedValueOnce({ success: false, error: "criterion changed" });

		const result = await trySaveCriterionGrade({
			saveCriterionGrade,
			gridId: "grid-1",
			targetId: "target-1",
			rubricId: "rubric-1",
			grade: { criterionId: "criterion-1", kind: "check", passed: true },
			errorContext,
		});

		expect(result).toEqual({
			success: false,
			error: { ...errorContext, message: "criterion changed" },
		});
	});

	it("maps a thrown/rejected server action call to an unreachable failure instead of leaving the save pending forever", async () => {
		const saveCriterionGrade = vi
			.fn()
			.mockRejectedValueOnce(new Error("fetch failed"));

		const result = await trySaveCriterionGrade({
			saveCriterionGrade,
			gridId: "grid-1",
			targetId: "target-1",
			rubricId: "rubric-1",
			grade: { criterionId: "criterion-1", kind: "check", passed: true },
			errorContext,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toMatch(/connection|reach/i);
		}
	});
});
