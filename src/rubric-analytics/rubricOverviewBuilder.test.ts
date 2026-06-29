import { describe, expect, it } from "vitest";
import type { Grid } from "#questions/types.ts";
import type { Submission } from "#submissions/types.ts";
import {
	buildRubricOverviewData,
	type RubricOverviewAssessmentRecord,
} from "./rubricOverviewBuilder.ts";

describe("buildRubricOverviewData", () => {
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

	const questionGrid: Grid = {
		q1: {
			label: "Question 1",
			rubrics: [
				{
					id: "r-boolean",
					type: "boolean",
					marks: 2,
					falseMarks: 0,
					label: "Correct",
					description: "Correct answer",
				},
			],
		},
		q2: {
			label: "Question 2",
			rubrics: [
				{
					id: "r-numerical",
					type: "numerical",
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

	it("preserves authored rubric order", () => {
		const data = buildRubricOverviewData({
			submissions,
			questionGrid,
			assessmentRecords: [],
		});

		expect(data.rubrics.map((rubric) => rubric.rubricId)).toEqual([
			"r-boolean",
			"r-numerical",
		]);
	});

	it("computes averages and completion for mixed rubric types", () => {
		const records: RubricOverviewAssessmentRecord[] = [
			{
				submissionId: 1,
				rubricId: "r-boolean",
				type: "boolean",
				passed: true,
				selectedLabel: null,
				score: null,
			},
			{
				submissionId: 2,
				rubricId: "r-boolean",
				type: "boolean",
				passed: false,
				selectedLabel: null,
				score: null,
			},
			{
				submissionId: 1,
				rubricId: "r-numerical",
				type: "numerical",
				passed: null,
				selectedLabel: null,
				score: 8,
			},
		];

		const data = buildRubricOverviewData({
			submissions,
			questionGrid,
			assessmentRecords: records,
		});

		const booleanRubric = data.rubrics.find(
			(row) => row.rubricId === "r-boolean",
		);
		const numericalRubric = data.rubrics.find(
			(row) => row.rubricId === "r-numerical",
		);

		expect(booleanRubric).toMatchObject({
			assessedCount: 2,
			totalCount: 2,
			completionPercent: 100,
			averageMarks: 1,
			averagePercent: 50,
		});

		expect(numericalRubric).toMatchObject({
			assessedCount: 1,
			totalCount: 2,
			completionPercent: 50,
			averageMarks: 4,
			averagePercent: 80,
		});

		expect(data.summary).toMatchObject({
			classAverageMarks: 3,
			classAverageMaxMarks: 4.5,
		});
	});

	it("maps popup details with type-specific properties", () => {
		const data = buildRubricOverviewData({
			submissions,
			questionGrid,
			assessmentRecords: [],
		});

		expect(data.rubrics[0]?.details).toEqual({
			label: "Correct",
			description: "Correct answer",
			type: "boolean",
			properties: { type: "boolean", trueMarks: 2, falseMarks: 0 },
		});

		expect(data.rubrics[1]?.details).toEqual({
			label: "Quality",
			description: "Quality from 0 to 10",
			type: "numerical",
			properties: {
				type: "numerical",
				minScore: 0,
				maxScore: 10,
				minMarks: 0,
				maxMarks: 5,
				reversed: false,
			},
		});
	});

	it("skips duplicate assessment records for the same submission/rubric pair (first wins)", () => {
		const records: RubricOverviewAssessmentRecord[] = [
			{
				submissionId: 1,
				rubricId: "r-boolean",
				type: "boolean",
				passed: true,
				selectedLabel: null,
				score: null,
			},
			{
				submissionId: 1,
				rubricId: "r-boolean",
				type: "boolean",
				passed: false,
				selectedLabel: null,
				score: null,
			},
		];

		const data = buildRubricOverviewData({
			submissions,
			questionGrid,
			assessmentRecords: records,
		});

		const booleanRubric = data.rubrics.find(
			(row) => row.rubricId === "r-boolean",
		);

		expect(booleanRubric).toMatchObject({ assessedCount: 1, averageMarks: 2 });

		const studentOne = data.students.find(
			(student) => student.submissionId === "1",
		);
		expect(studentOne?.marks).toBe(2);
		expect(studentOne?.completedRubrics).toBe(1);
	});

	it("treats a null value field as unassessed for each rubric type", () => {
		const ordinalGrid: Grid = {
			q1: {
				label: "Question 1",
				rubrics: [
					{
						id: "r-boolean",
						type: "boolean",
						marks: 2,
						falseMarks: 0,
						label: "Correct",
						description: "Correct answer",
					},
				],
			},
			q2: {
				label: "Question 2",
				rubrics: [
					{
						id: "r-ordinal",
						type: "ordinal",
						marks: { low: 1, high: 3 },
						label: "Rating",
						description: "Rating scale",
					},
				],
			},
			q3: {
				label: "Question 3",
				rubrics: [
					{
						id: "r-numerical",
						type: "numerical",
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

		const records: RubricOverviewAssessmentRecord[] = [
			{
				submissionId: 1,
				rubricId: "r-boolean",
				type: "boolean",
				passed: null,
				selectedLabel: null,
				score: null,
			},
			{
				submissionId: 1,
				rubricId: "r-ordinal",
				type: "ordinal",
				passed: null,
				selectedLabel: null,
				score: null,
			},
			{
				submissionId: 1,
				rubricId: "r-numerical",
				type: "numerical",
				passed: null,
				selectedLabel: null,
				score: null,
			},
		];

		const data = buildRubricOverviewData({
			submissions,
			questionGrid: ordinalGrid,
			assessmentRecords: records,
		});

		for (const rubric of data.rubrics) {
			expect(rubric.assessedCount).toBe(0);
		}

		const studentOne = data.students.find(
			(student) => student.submissionId === "1",
		);
		expect(studentOne?.completedRubrics).toBe(0);
		expect(studentOne?.rubrics.every((cell) => !cell.assessed)).toBe(true);
	});

	it("skips records referencing an unknown rubricId or submissionId", () => {
		const records: RubricOverviewAssessmentRecord[] = [
			{
				submissionId: 1,
				rubricId: "unknown-rubric",
				type: "boolean",
				passed: true,
				selectedLabel: null,
				score: null,
			},
			{
				submissionId: 999,
				rubricId: "r-boolean",
				type: "boolean",
				passed: true,
				selectedLabel: null,
				score: null,
			},
		];

		const data = buildRubricOverviewData({
			submissions,
			questionGrid,
			assessmentRecords: records,
		});

		const booleanRubric = data.rubrics.find(
			(row) => row.rubricId === "r-boolean",
		);
		expect(booleanRubric?.assessedCount).toBe(0);
		expect(
			data.students.every((student) => student.completedRubrics === 0),
		).toBe(true);
	});

	it("aggregates class averages across heterogeneous rubric types and maxMarks", () => {
		const mixedGrid: Grid = {
			q1: {
				label: "Question 1",
				rubrics: [
					{
						id: "r-boolean",
						type: "boolean",
						marks: 2,
						falseMarks: 0,
						label: "Correct",
						description: "Correct answer",
					},
				],
			},
			q2: {
				label: "Question 2",
				rubrics: [
					{
						id: "r-ordinal",
						type: "ordinal",
						marks: { low: 1, medium: 2, high: 3 },
						label: "Rating",
						description: "Rating scale",
					},
				],
			},
			q3: {
				label: "Question 3",
				rubrics: [
					{
						id: "r-numerical",
						type: "numerical",
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

		const records: RubricOverviewAssessmentRecord[] = [
			{
				submissionId: 1,
				rubricId: "r-boolean",
				type: "boolean",
				passed: true,
				selectedLabel: null,
				score: null,
			},
			{
				submissionId: 1,
				rubricId: "r-ordinal",
				type: "ordinal",
				passed: null,
				selectedLabel: "high",
				score: null,
			},
			{
				submissionId: 1,
				rubricId: "r-numerical",
				type: "numerical",
				passed: null,
				selectedLabel: null,
				score: 10,
			},
			{
				submissionId: 2,
				rubricId: "r-boolean",
				type: "boolean",
				passed: false,
				selectedLabel: null,
				score: null,
			},
		];

		const data = buildRubricOverviewData({
			submissions,
			questionGrid: mixedGrid,
			assessmentRecords: records,
		});

		// Alice (submission 1): 2 (boolean) + 3 (ordinal high) + 5 (numerical max) = 10, out of 2+3+5 = 10
		// Bob (submission 2): 0 (boolean, missed) only, out of 2 (only the boolean rubric is assessed for him)
		expect(data.summary.classAverageMarks).toBe((10 + 0) / 2);
		expect(data.summary.classAverageMaxMarks).toBe((10 + 2) / 2);
		expect(data.summary.assessedRubrics).toBe(4);
		expect(data.summary.totalRubrics).toBe(6);
	});
});
