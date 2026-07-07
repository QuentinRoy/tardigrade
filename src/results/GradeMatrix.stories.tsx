import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GradeMatrix from "./GradeMatrix.tsx";

const criteria = [
	{
		criterionId: "r-correctness",
		rubricId: "q1",
		rubricLabel: "Question 1",
		maxMarks: 5,
		averageMarks: 3.5,
		averagePercent: 70,
		assessedCount: 3,
		totalCount: 4,
		completionPercent: 75,
		details: {
			label: "Correctness",
			description: "Checks final correctness",
			type: "boolean" as const,
			properties: { type: "boolean" as const, trueMarks: 5, falseMarks: 0 },
		},
	},
	{
		criterionId: "r-explanation",
		rubricId: "q2",
		rubricLabel: "Question 2",
		maxMarks: 4,
		averageMarks: 1.2,
		averagePercent: 30,
		assessedCount: 2,
		totalCount: 4,
		completionPercent: 50,
		details: {
			label: "Explanation quality",
			description: "Quality and structure of explanation",
			type: "ordinal" as const,
			properties: {
				type: "ordinal" as const,
				marksByLabel: [
					{ label: "Excellent", marks: 4 },
					{ label: "Good", marks: 3 },
					{ label: "Fair", marks: 2 },
					{ label: "Poor", marks: 1 },
				],
			},
		},
	},
];

const gradeTargetRows = [
	{
		gradeTargetId: "1",
		label: "Alice A",
		marks: 7.5,
		maxMarks: 9,
		averagePercent: 83.3,
		completedCriteria: 2,
		totalCriteria: 2,
		criteria: [
			{ criterionId: "r-correctness", marks: 5, maxMarks: 5, assessed: true },
			{ criterionId: "r-explanation", marks: 2.5, maxMarks: 4, assessed: true },
		],
	},
	{
		gradeTargetId: "2",
		label: "Bob B",
		marks: 2,
		maxMarks: 5,
		averagePercent: 40,
		completedCriteria: 1,
		totalCriteria: 2,
		criteria: [
			{ criterionId: "r-correctness", marks: 2, maxMarks: 5, assessed: true },
			{
				criterionId: "r-explanation",
				marks: null,
				maxMarks: 4,
				assessed: false,
			},
		],
	},
];

const meta = {
	title: "Assessment/GradeMatrix",
	component: GradeMatrix,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: { criteria, gradeTargetRows },
} satisfies Meta<typeof GradeMatrix>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Partial: Story = {};

export const Empty: Story = { args: { criteria: [], gradeTargetRows: [] } };

export const Complete: Story = {
	args: {
		gradeTargetRows: gradeTargetRows.map((gradeTargetRow) => ({
			...gradeTargetRow,
			completedCriteria: gradeTargetRow.totalCriteria,
			criteria: gradeTargetRow.criteria.map((cell) => ({
				...cell,
				assessed: true,
				marks: cell.marks ?? 2,
			})),
			marks: gradeTargetRow.maxMarks,
		})),
	},
};
