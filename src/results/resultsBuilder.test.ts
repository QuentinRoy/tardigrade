import { describe, expect, it } from "vitest";
import type { GradeTarget } from "#grade-targets/types.ts";
import type { RubricsById } from "#rubrics/types.ts";
import { buildResultsData, type ResultsGradeRecord } from "./resultsBuilder.ts";

describe("buildResultsData", () => {
	const targets: GradeTarget[] = [
		{
			id: "1",
			kind: "individual",
			studentName: "Alice A",
			displayLabel: "Alice A",
			memberNames: [],
			searchKeys: ["alice a"],
		},
		{
			id: "2",
			kind: "individual",
			studentName: "Bob B",
			displayLabel: "Bob B",
			memberNames: [],
			searchKeys: ["bob b"],
		},
	];

	const rubricsById: RubricsById = {
		q1: {
			label: "Rubric 1",
			criteria: [
				{
					id: "r-check",
					kind: "check",
					marks: 2,
					falseMarks: 0,
					label: "Correct",
					description: "Correct answer",
				},
			],
		},
		q2: {
			label: "Rubric 2",
			criteria: [
				{
					id: "r-number",
					kind: "number",
					minValue: 0,
					maxValue: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
					label: "Quality",
					description: "Quality from 0 to 10",
				},
			],
		},
	};

	it("preserves authored criterion order", () => {
		const data = buildResultsData({ targets, rubricsById, gradeRecords: [] });

		expect(data.criteria.map((criterion) => criterion.criterionId)).toEqual([
			"r-check",
			"r-number",
		]);
	});

	it("computes averages and completion for mixed criterion kinds", () => {
		const records: ResultsGradeRecord[] = [
			{
				gradeTargetId: "1",
				criterionId: "r-check",
				kind: "check",
				passed: true,
				selectedLabel: null,
				value: null,
			},
			{
				gradeTargetId: "2",
				criterionId: "r-check",
				kind: "check",
				passed: false,
				selectedLabel: null,
				value: null,
			},
			{
				gradeTargetId: "1",
				criterionId: "r-number",
				kind: "number",
				passed: null,
				selectedLabel: null,
				value: 8,
			},
		];

		const data = buildResultsData({
			targets,
			rubricsById,
			gradeRecords: records,
		});

		const checkCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-check",
		);
		const numberCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-number",
		);

		expect(checkCriterion).toMatchObject({
			gradedCount: 2,
			totalCount: 2,
			completionPercent: 100,
			averageMarks: 1,
			averagePercent: 50,
		});

		expect(numberCriterion).toMatchObject({
			gradedCount: 1,
			totalCount: 2,
			completionPercent: 50,
			averageMarks: 4,
			averagePercent: 80,
		});
	});

	it("maps details with type-specific properties", () => {
		const data = buildResultsData({ targets, rubricsById, gradeRecords: [] });

		expect(data.criteria[0]?.details).toEqual({
			label: "Correct",
			description: "Correct answer",
			kind: "check",
			properties: { kind: "check", trueMarks: 2, falseMarks: 0 },
		});

		expect(data.criteria[1]?.details).toEqual({
			label: "Quality",
			description: "Quality from 0 to 10",
			kind: "number",
			properties: {
				kind: "number",
				minValue: 0,
				maxValue: 10,
				minMarks: 0,
				maxMarks: 5,
				reversed: false,
			},
		});
	});

	it("skips duplicate grade records for the same grade target/criterion pair (first wins)", () => {
		const records: ResultsGradeRecord[] = [
			{
				gradeTargetId: "1",
				criterionId: "r-check",
				kind: "check",
				passed: true,
				selectedLabel: null,
				value: null,
			},
			{
				gradeTargetId: "1",
				criterionId: "r-check",
				kind: "check",
				passed: false,
				selectedLabel: null,
				value: null,
			},
		];

		const data = buildResultsData({
			targets,
			rubricsById,
			gradeRecords: records,
		});

		const checkCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-check",
		);

		expect(checkCriterion).toMatchObject({ gradedCount: 1, averageMarks: 2 });

		const gradeTargetOne = data.gradeTargetRows.find(
			(gradeTargetRow) => gradeTargetRow.gradeTargetId === "1",
		);
		expect(gradeTargetOne?.marks).toBe(2);
		expect(gradeTargetOne?.completedCriteria).toBe(1);
	});

	it("treats a null value field as ungraded for each criterion kind", () => {
		const optionsGrid: RubricsById = {
			q1: {
				label: "Rubric 1",
				criteria: [
					{
						id: "r-check",
						kind: "check",
						marks: 2,
						falseMarks: 0,
						label: "Correct",
						description: "Correct answer",
					},
				],
			},
			q2: {
				label: "Rubric 2",
				criteria: [
					{
						id: "r-options",
						kind: "options",
						marks: { low: 1, high: 3 },
						label: "Rating",
						description: "Rating scale",
					},
				],
			},
			q3: {
				label: "Rubric 3",
				criteria: [
					{
						id: "r-number",
						kind: "number",
						minValue: 0,
						maxValue: 10,
						minMarks: 0,
						maxMarks: 5,
						reversed: false,
						label: "Quality",
						description: "Quality from 0 to 10",
					},
				],
			},
		};

		const records: ResultsGradeRecord[] = [
			{
				gradeTargetId: "1",
				criterionId: "r-check",
				kind: "check",
				passed: null,
				selectedLabel: null,
				value: null,
			},
			{
				gradeTargetId: "1",
				criterionId: "r-options",
				kind: "options",
				passed: null,
				selectedLabel: null,
				value: null,
			},
			{
				gradeTargetId: "1",
				criterionId: "r-number",
				kind: "number",
				passed: null,
				selectedLabel: null,
				value: null,
			},
		];

		const data = buildResultsData({
			targets,
			rubricsById: optionsGrid,
			gradeRecords: records,
		});

		for (const criterion of data.criteria) {
			expect(criterion.gradedCount).toBe(0);
		}

		const gradeTargetOne = data.gradeTargetRows.find(
			(gradeTargetRow) => gradeTargetRow.gradeTargetId === "1",
		);
		expect(gradeTargetOne?.completedCriteria).toBe(0);
		expect(gradeTargetOne?.criteria.every((cell) => !cell.graded)).toBe(true);
	});

	it("skips records referencing an unknown criterionId or gradeTargetId", () => {
		const records: ResultsGradeRecord[] = [
			{
				gradeTargetId: "1",
				criterionId: "unknown-criterion",
				kind: "check",
				passed: true,
				selectedLabel: null,
				value: null,
			},
			{
				gradeTargetId: "999",
				criterionId: "r-check",
				kind: "check",
				passed: true,
				selectedLabel: null,
				value: null,
			},
		];

		const data = buildResultsData({
			targets,
			rubricsById,
			gradeRecords: records,
		});

		const checkCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-check",
		);
		expect(checkCriterion?.gradedCount).toBe(0);
		expect(
			data.gradeTargetRows.every(
				(gradeTargetRow) => gradeTargetRow.completedCriteria === 0,
			),
		).toBe(true);
	});
});
