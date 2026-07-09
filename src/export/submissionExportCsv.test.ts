import { describe, expect, it } from "vitest";
import type { SubmissionSubmitter } from "#submissions/types.ts";
import {
	buildSubmissionExportHeaders,
	buildSubmissionExportRecord,
} from "./submissionExportCsv.ts";

describe("submission CSV ordering", () => {
	const questions = [
		{
			id: "q1",
			criteria: [
				{ id: "r1", kind: "check" as const, marks: 2, falseMarks: -1 },
				{ id: "r2", kind: "options" as const, marks: { A: 3, B: 1 } },
			],
		},
		{
			id: "q2",
			criteria: [
				{
					id: "r3",
					kind: "number" as const,
					minScore: 0,
					maxScore: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
				},
			],
		},
	];

	const fullyAssessedQuestions = [
		{
			questionId: "q1",
			criteria: [
				{ criterionId: "r1", assessment: true, marks: 2 },
				{ criterionId: "r2", assessment: "B", marks: 1 },
			],
		},
		{
			questionId: "q2",
			criteria: [{ criterionId: "r3", assessment: 8, marks: 4 }],
		},
	];

	const failedBooleanQuestions = [
		{
			questionId: "q1",
			criteria: [
				{ criterionId: "r1", assessment: false, marks: -1 },
				{ criterionId: "r2" },
			],
		},
		{ questionId: "q2", criteria: [{ criterionId: "r3" }] },
	];

	const unassessedQuestions = [
		{
			questionId: "q1",
			criteria: [{ criterionId: "r1" }, { criterionId: "r2" }],
		},
		{ questionId: "q2", criteria: [{ criterionId: "r3" }] },
	];

	it("builds headers in criterion-before-question-total order", () => {
		const headers = buildSubmissionExportHeaders(questions, {
			includeCriterionAssessment: true,
			includeCriterionMarks: true,
		});

		expect(headers).toEqual([
			"submission_type",
			"submitter",
			"q1:r1",
			"q1:r1:marks",
			"q1:r2",
			"q1:r2:marks",
			"q1",
			"q2:r3",
			"q2:r3:marks",
			"q2",
			"grand_total_marks",
		]);
	});

	it("builds sparse record values with question totals and grand total", () => {
		const row = buildSubmissionExportRecord({
			row: {
				submission: { id: "sub-1", type: "individual", studentId: "stu-123" },
				questions: fullyAssessedQuestions,
			},
			options: {
				includeCriterionAssessment: true,
				includeCriterionMarks: true,
			},
		});

		expect(row).toMatchInlineSnapshot(`
      {
        "grand_total_marks": 7,
        "q1": 3,
        "q1:r1": true,
        "q1:r1:marks": 2,
        "q1:r2": "B",
        "q1:r2:marks": 1,
        "q2": 4,
        "q2:r3": 8,
        "q2:r3:marks": 4,
        "submission_type": "individual",
        "submitter": "stu-123",
      }
    `);
	});

	it("uses falseMarks when a boolean criterion is not passed", () => {
		const row = buildSubmissionExportRecord({
			row: {
				submission: { id: "sub-1", type: "individual", studentId: "stu-123" },
				questions: failedBooleanQuestions,
			},
			options: {
				includeCriterionAssessment: true,
				includeCriterionMarks: true,
			},
		});

		expect(row).toMatchInlineSnapshot(`
      {
        "q1:r1": false,
        "q1:r1:marks": -1,
        "submission_type": "individual",
        "submitter": "stu-123",
      }
    `);
	});

	it("throws when submission type invariant is broken", () => {
		expect(() =>
			buildSubmissionExportRecord({
				row: {
					submission: { id: "sub-team", type: "team", teamName: "" },
					questions: unassessedQuestions,
				},
				options: {
					includeCriterionAssessment: false,
					includeCriterionMarks: false,
				},
			}),
		).toThrow("Submission sub-team has type team but no team is linked.");
	});

	it("uses team name as submitter for team submissions", () => {
		const row = buildSubmissionExportRecord({
			row: {
				submission: { id: "sub-team-1", type: "team", teamName: "Team A" },
				questions: unassessedQuestions,
			},
			options: {
				includeCriterionAssessment: true,
				includeCriterionMarks: false,
			},
		});

		expect(row).toMatchInlineSnapshot(`
      {
        "submission_type": "team",
        "submitter": "Team A",
      }
    `);
	});

	it("requires student id for individual submissions at the type level", () => {
		type IndividualSubmitter = Extract<
			SubmissionSubmitter,
			{ type: "individual" }
		>;

		// @ts-expect-error missing studentId for individual submission
		const _invalidIndividualSubmitter: IndividualSubmitter = {
			id: "sub-ind-1",
			type: "individual",
		};
	});
});
