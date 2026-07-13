import { describe, expect, it } from "vitest";
import type { GradedCriterion } from "#criteria/types.ts";
import { summarizeCriteria, summarizeRubricSections } from "./gradeSummary.ts";

const gradedCheckCriterion: GradedCriterion<"check"> = {
	id: "r1",
	kind: "check",
	marks: 2,
	falseMarks: 0,
	grade: { passed: true },
};

const ungradedCheckCriterion: GradedCriterion<"check"> = {
	id: "r2",
	kind: "check",
	marks: 3,
	falseMarks: 0,
	grade: null,
};

describe("summarizeCriteria", () => {
	it("accumulates marks and maxMarks only from graded criteria", () => {
		const summary = summarizeCriteria([
			gradedCheckCriterion,
			ungradedCheckCriterion,
		]);

		expect(summary).toEqual({
			marks: 2,
			maxMarks: 2,
			completedCriteria: 1,
			totalCriteria: 2,
		});
	});
});

describe("summarizeRubricSections", () => {
	it("accumulates marks and maxMarks across rubrics", () => {
		const summary = summarizeRubricSections([
			{ criteria: [gradedCheckCriterion] },
			{ criteria: [ungradedCheckCriterion] },
		]);

		expect(summary.marks).toBe(2);
		expect(summary.maxMarks).toBe(2);
		expect(summary.completedCriteria).toBe(1);
		expect(summary.totalCriteria).toBe(2);
	});

	it("counts a fully graded rubric toward completedRubrics", () => {
		const summary = summarizeRubricSections([
			{ criteria: [gradedCheckCriterion] },
		]);

		expect(summary.completedRubrics).toBe(1);
		expect(summary.totalRubrics).toBe(1);
	});

	it("does not count a partially graded rubric toward completedRubrics", () => {
		const summary = summarizeRubricSections([
			{ criteria: [gradedCheckCriterion, ungradedCheckCriterion] },
		]);

		expect(summary.completedRubrics).toBe(0);
		expect(summary.totalRubrics).toBe(1);
	});

	it("counts a zero-criterion rubric toward completedRubrics", () => {
		const summary = summarizeRubricSections([{ criteria: [] }]);

		expect(summary.completedRubrics).toBe(1);
		expect(summary.totalRubrics).toBe(1);
	});
});
