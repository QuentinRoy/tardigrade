import { describe, expect, it } from "vitest";
import type { AssessedCriterion } from "#criteria/types.ts";
import {
	summarizeCriteria,
	summarizeRubricSections,
} from "./assessmentSummary.ts";

const assessedCheckCriterion: AssessedCriterion<"check"> = {
	id: "r1",
	kind: "check",
	marks: 2,
	falseMarks: 0,
	assessment: { passed: true },
};

const unassessedCheckCriterion: AssessedCriterion<"check"> = {
	id: "r2",
	kind: "check",
	marks: 3,
	falseMarks: 0,
	assessment: null,
};

describe("summarizeCriteria", () => {
	it("accumulates marks and maxMarks only from assessed criteria", () => {
		const summary = summarizeCriteria([
			assessedCheckCriterion,
			unassessedCheckCriterion,
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
			{ criteria: [assessedCheckCriterion] },
			{ criteria: [unassessedCheckCriterion] },
		]);

		expect(summary.marks).toBe(2);
		expect(summary.maxMarks).toBe(2);
		expect(summary.completedCriteria).toBe(1);
		expect(summary.totalCriteria).toBe(2);
	});

	it("counts a fully assessed rubric toward completedRubrics", () => {
		const summary = summarizeRubricSections([
			{ criteria: [assessedCheckCriterion] },
		]);

		expect(summary.completedRubrics).toBe(1);
		expect(summary.totalRubrics).toBe(1);
	});

	it("does not count a partially assessed rubric toward completedRubrics", () => {
		const summary = summarizeRubricSections([
			{ criteria: [assessedCheckCriterion, unassessedCheckCriterion] },
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
