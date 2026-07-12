import { describe, expect, it } from "vitest";
import type { GradeTargetSubmitter } from "#grade-targets/types.ts";
import {
	buildGradeTargetExportHeaders,
	buildGradeTargetExportRecord,
} from "./gradeTargetExportCsv.ts";

describe("grade target CSV ordering", () => {
	const rubrics = [
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

	const fullyAssessedRubrics = [
		{
			rubricId: "q1",
			criteria: [
				{ criterionId: "r1", assessment: true, marks: 2 },
				{ criterionId: "r2", assessment: "B", marks: 1 },
			],
		},
		{
			rubricId: "q2",
			criteria: [{ criterionId: "r3", assessment: 8, marks: 4 }],
		},
	];

	const failedBooleanRubrics = [
		{
			rubricId: "q1",
			criteria: [
				{ criterionId: "r1", assessment: false, marks: -1 },
				{ criterionId: "r2" },
			],
		},
		{ rubricId: "q2", criteria: [{ criterionId: "r3" }] },
	];

	const unassessedRubrics = [
		{
			rubricId: "q1",
			criteria: [{ criterionId: "r1" }, { criterionId: "r2" }],
		},
		{ rubricId: "q2", criteria: [{ criterionId: "r3" }] },
	];

	it("builds headers in criterion-before-rubric-total order", () => {
		const headers = buildGradeTargetExportHeaders(rubrics, {
			includeCriterionAssessment: true,
			includeCriterionMarks: true,
		});

		expect(headers).toEqual([
			"kind",
			"name",
			"q1:r1",
			"q1:r1:marks",
			"q1:r2",
			"q1:r2:marks",
			"q1:total",
			"q2:r3",
			"q2:r3:marks",
			"q2:total",
			"final_total",
		]);
	});

	it("builds sparse record values with rubric totals and final total", () => {
		const row = buildGradeTargetExportRecord({
			row: {
				target: { id: "t-1", kind: "individual", studentId: "stu-123" },
				rubrics: fullyAssessedRubrics,
			},
			options: {
				includeCriterionAssessment: true,
				includeCriterionMarks: true,
			},
		});

		expect(row).toMatchInlineSnapshot(`
      {
        "final_total": 7,
        "kind": "individual",
        "name": "stu-123",
        "q1:r1": true,
        "q1:r1:marks": 2,
        "q1:r2": "B",
        "q1:r2:marks": 1,
        "q1:total": 3,
        "q2:r3": 8,
        "q2:r3:marks": 4,
        "q2:total": 4,
      }
    `);
	});

	it("uses falseMarks when a check criterion is not passed", () => {
		const row = buildGradeTargetExportRecord({
			row: {
				target: { id: "t-1", kind: "individual", studentId: "stu-123" },
				rubrics: failedBooleanRubrics,
			},
			options: {
				includeCriterionAssessment: true,
				includeCriterionMarks: true,
			},
		});

		expect(row).toMatchInlineSnapshot(`
      {
        "kind": "individual",
        "name": "stu-123",
        "q1:r1": false,
        "q1:r1:marks": -1,
      }
    `);
	});

	it("throws when grade target kind invariant is broken", () => {
		expect(() =>
			buildGradeTargetExportRecord({
				row: {
					target: { id: "t-group", kind: "group", groupName: "" },
					rubrics: unassessedRubrics,
				},
				options: {
					includeCriterionAssessment: false,
					includeCriterionMarks: false,
				},
			}),
		).toThrow("Grade target t-group has kind group but no group is linked.");
	});

	it("uses group name as export name for group targets", () => {
		const row = buildGradeTargetExportRecord({
			row: {
				target: { id: "t-group-1", kind: "group", groupName: "Group A" },
				rubrics: unassessedRubrics,
			},
			options: {
				includeCriterionAssessment: true,
				includeCriterionMarks: false,
			},
		});

		expect(row).toMatchInlineSnapshot(`
      {
        "kind": "group",
        "name": "Group A",
      }
    `);
	});

	it("requires student id for individual targets at the type level", () => {
		type IndividualSubmitter = Extract<
			GradeTargetSubmitter,
			{ kind: "individual" }
		>;

		// @ts-expect-error missing studentId for individual grade target
		const _invalidIndividualSubmitter: IndividualSubmitter = {
			id: "t-ind-1",
			kind: "individual",
		};
	});
});
