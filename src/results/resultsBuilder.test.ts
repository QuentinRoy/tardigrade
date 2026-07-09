import { describe, expect, it } from "vitest";
import type { RubricsById } from "#rubrics/types.ts";
import type { Submission } from "#submissions/types.ts";
import {
	buildResultsData,
	type ResultsAssessmentRecord,
} from "./resultsBuilder.ts";

describe("buildResultsData", () => {
	const submissions: Submission[] = [
		{
			id: "1",
			type: "individual",
			studentName: "Alice A",
			displayLabel: "Alice A",
			memberNames: [],
			searchKeys: ["alice a"],
		},
		{
			id: "2",
			type: "individual",
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
					id: "r-boolean",
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
					id: "r-numerical",
					kind: "number",
					minScore: 0,
					maxScore: 10,
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
		const data = buildResultsData({
			submissions,
			rubricsById,
			assessmentRecords: [],
		});

		expect(data.criteria.map((criterion) => criterion.criterionId)).toEqual([
			"r-boolean",
			"r-numerical",
		]);
	});

	it("computes averages and completion for mixed criterion kinds", () => {
		const records: ResultsAssessmentRecord[] = [
			{
				gradeTargetId: 1,
				criterionId: "r-boolean",
				kind: "check",
				passed: true,
				selectedLabel: null,
				score: null,
			},
			{
				gradeTargetId: 2,
				criterionId: "r-boolean",
				kind: "check",
				passed: false,
				selectedLabel: null,
				score: null,
			},
			{
				gradeTargetId: 1,
				criterionId: "r-numerical",
				kind: "number",
				passed: null,
				selectedLabel: null,
				score: 8,
			},
		];

		const data = buildResultsData({
			submissions,
			rubricsById,
			assessmentRecords: records,
		});

		const booleanCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-boolean",
		);
		const numericalCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-numerical",
		);

		expect(booleanCriterion).toMatchObject({
			assessedCount: 2,
			totalCount: 2,
			completionPercent: 100,
			averageMarks: 1,
			averagePercent: 50,
		});

		expect(numericalCriterion).toMatchObject({
			assessedCount: 1,
			totalCount: 2,
			completionPercent: 50,
			averageMarks: 4,
			averagePercent: 80,
		});
	});

	it("maps details with type-specific properties", () => {
		const data = buildResultsData({
			submissions,
			rubricsById,
			assessmentRecords: [],
		});

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
				minScore: 0,
				maxScore: 10,
				minMarks: 0,
				maxMarks: 5,
				reversed: false,
			},
		});
	});

	it("skips duplicate assessment records for the same grade target/criterion pair (first wins)", () => {
		const records: ResultsAssessmentRecord[] = [
			{
				gradeTargetId: 1,
				criterionId: "r-boolean",
				kind: "check",
				passed: true,
				selectedLabel: null,
				score: null,
			},
			{
				gradeTargetId: 1,
				criterionId: "r-boolean",
				kind: "check",
				passed: false,
				selectedLabel: null,
				score: null,
			},
		];

		const data = buildResultsData({
			submissions,
			rubricsById,
			assessmentRecords: records,
		});

		const booleanCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-boolean",
		);

		expect(booleanCriterion).toMatchObject({
			assessedCount: 1,
			averageMarks: 2,
		});

		const gradeTargetOne = data.gradeTargetRows.find(
			(gradeTargetRow) => gradeTargetRow.gradeTargetId === "1",
		);
		expect(gradeTargetOne?.marks).toBe(2);
		expect(gradeTargetOne?.completedCriteria).toBe(1);
	});

	it("treats a null value field as unassessed for each criterion kind", () => {
		const ordinalGrid: RubricsById = {
			q1: {
				label: "Rubric 1",
				criteria: [
					{
						id: "r-boolean",
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
						id: "r-ordinal",
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
						id: "r-numerical",
						kind: "number",
						minScore: 0,
						maxScore: 10,
						minMarks: 0,
						maxMarks: 5,
						reversed: false,
						label: "Quality",
						description: "Quality from 0 to 10",
					},
				],
			},
		};

		const records: ResultsAssessmentRecord[] = [
			{
				gradeTargetId: 1,
				criterionId: "r-boolean",
				kind: "check",
				passed: null,
				selectedLabel: null,
				score: null,
			},
			{
				gradeTargetId: 1,
				criterionId: "r-ordinal",
				kind: "options",
				passed: null,
				selectedLabel: null,
				score: null,
			},
			{
				gradeTargetId: 1,
				criterionId: "r-numerical",
				kind: "number",
				passed: null,
				selectedLabel: null,
				score: null,
			},
		];

		const data = buildResultsData({
			submissions,
			rubricsById: ordinalGrid,
			assessmentRecords: records,
		});

		for (const criterion of data.criteria) {
			expect(criterion.assessedCount).toBe(0);
		}

		const gradeTargetOne = data.gradeTargetRows.find(
			(gradeTargetRow) => gradeTargetRow.gradeTargetId === "1",
		);
		expect(gradeTargetOne?.completedCriteria).toBe(0);
		expect(gradeTargetOne?.criteria.every((cell) => !cell.assessed)).toBe(true);
	});

	it("skips records referencing an unknown criterionId or gradeTargetId", () => {
		const records: ResultsAssessmentRecord[] = [
			{
				gradeTargetId: 1,
				criterionId: "unknown-criterion",
				kind: "check",
				passed: true,
				selectedLabel: null,
				score: null,
			},
			{
				gradeTargetId: 999,
				criterionId: "r-boolean",
				kind: "check",
				passed: true,
				selectedLabel: null,
				score: null,
			},
		];

		const data = buildResultsData({
			submissions,
			rubricsById,
			assessmentRecords: records,
		});

		const booleanCriterion = data.criteria.find(
			(criterion) => criterion.criterionId === "r-boolean",
		);
		expect(booleanCriterion?.assessedCount).toBe(0);
		expect(
			data.gradeTargetRows.every(
				(gradeTargetRow) => gradeTargetRow.completedCriteria === 0,
			),
		).toBe(true);
	});
});
