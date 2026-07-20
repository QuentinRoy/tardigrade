import { describe, expect, it } from "vitest";
import { hasSameGrade } from "./criterion.ts";
import type { GradedCriterion } from "./types.ts";

const checkCriterion: GradedCriterion = {
	id: "c1",
	kind: "check",
	marks: 1,
	falseMarks: 0,
	grade: { passed: true },
};

describe("hasSameGrade", () => {
	it("matches a grade holding the same content", () => {
		expect(
			hasSameGrade(checkCriterion, {
				criterionId: "c1",
				kind: "check",
				passed: true,
			}),
		).toBe(true);
	});

	it("does not match a grade holding different content", () => {
		expect(
			hasSameGrade(checkCriterion, {
				criterionId: "c1",
				kind: "check",
				passed: false,
			}),
		).toBe(false);
	});

	it("does not match an ungraded criterion", () => {
		expect(
			hasSameGrade(
				{ ...checkCriterion, grade: null },
				{ criterionId: "c1", kind: "check", passed: true },
			),
		).toBe(false);
	});

	it("does not match a grade for another criterion", () => {
		expect(
			hasSameGrade(checkCriterion, {
				criterionId: "c2",
				kind: "check",
				passed: true,
			}),
		).toBe(false);
	});

	it("does not match a grade of another kind", () => {
		expect(
			hasSameGrade(checkCriterion, {
				criterionId: "c1",
				kind: "number",
				value: 1,
			}),
		).toBe(false);
	});
});
