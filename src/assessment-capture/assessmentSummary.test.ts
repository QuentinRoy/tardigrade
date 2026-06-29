import { describe, expect, it } from "vitest";
import type { AssessedRubric } from "#rubrics/types.ts";
import {
	summarizeQuestionSections,
	summarizeRubrics,
} from "./assessmentSummary.ts";

const assessedBooleanRubric: AssessedRubric<"boolean"> = {
	id: "r1",
	type: "boolean",
	marks: 2,
	falseMarks: 0,
	assessment: { passed: true },
};

const unassessedBooleanRubric: AssessedRubric<"boolean"> = {
	id: "r2",
	type: "boolean",
	marks: 3,
	falseMarks: 0,
	assessment: null,
};

describe("summarizeRubrics", () => {
	it("accumulates marks and maxMarks only from assessed rubrics", () => {
		const summary = summarizeRubrics([
			assessedBooleanRubric,
			unassessedBooleanRubric,
		]);

		expect(summary).toEqual({
			marks: 2,
			maxMarks: 2,
			completedRubrics: 1,
			totalRubrics: 2,
		});
	});
});

describe("summarizeQuestionSections", () => {
	it("accumulates marks and maxMarks across questions", () => {
		const summary = summarizeQuestionSections([
			{ rubrics: [assessedBooleanRubric] },
			{ rubrics: [unassessedBooleanRubric] },
		]);

		expect(summary.marks).toBe(2);
		expect(summary.maxMarks).toBe(2);
		expect(summary.completedRubrics).toBe(1);
		expect(summary.totalRubrics).toBe(2);
	});

	it("counts a fully assessed question toward completedQuestions", () => {
		const summary = summarizeQuestionSections([
			{ rubrics: [assessedBooleanRubric] },
		]);

		expect(summary.completedQuestions).toBe(1);
		expect(summary.totalQuestions).toBe(1);
	});

	it("does not count a partially assessed question toward completedQuestions", () => {
		const summary = summarizeQuestionSections([
			{ rubrics: [assessedBooleanRubric, unassessedBooleanRubric] },
		]);

		expect(summary.completedQuestions).toBe(0);
		expect(summary.totalQuestions).toBe(1);
	});

	it("counts a zero-rubric question toward completedQuestions", () => {
		const summary = summarizeQuestionSections([{ rubrics: [] }]);

		expect(summary.completedQuestions).toBe(1);
		expect(summary.totalQuestions).toBe(1);
	});
});
