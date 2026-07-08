import { describe, expect, it } from "vitest";
import type { AssessedCriterion } from "#criteria/types.ts";
import {
	summarizeCriteria,
	summarizeQuestionSections,
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

describe("summarizeQuestionSections", () => {
	it("accumulates marks and maxMarks across questions", () => {
		const summary = summarizeQuestionSections([
			{ criteria: [assessedCheckCriterion] },
			{ criteria: [unassessedCheckCriterion] },
		]);

		expect(summary.marks).toBe(2);
		expect(summary.maxMarks).toBe(2);
		expect(summary.completedCriteria).toBe(1);
		expect(summary.totalCriteria).toBe(2);
	});

	it("counts a fully assessed question toward completedQuestions", () => {
		const summary = summarizeQuestionSections([
			{ criteria: [assessedCheckCriterion] },
		]);

		expect(summary.completedQuestions).toBe(1);
		expect(summary.totalQuestions).toBe(1);
	});

	it("does not count a partially assessed question toward completedQuestions", () => {
		const summary = summarizeQuestionSections([
			{ criteria: [assessedCheckCriterion, unassessedCheckCriterion] },
		]);

		expect(summary.completedQuestions).toBe(0);
		expect(summary.totalQuestions).toBe(1);
	});

	it("counts a zero-criterion question toward completedQuestions", () => {
		const summary = summarizeQuestionSections([{ criteria: [] }]);

		expect(summary.completedQuestions).toBe(1);
		expect(summary.totalQuestions).toBe(1);
	});
});
