import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CriterionAnalyticsTable from "./CriterionAnalyticsTable.tsx";

const criteria = [
	{
		criterionId: "r-correctness",
		rubricId: "q1",
		rubricLabel: "Rubric 1",
		maxMarks: 5,
		averageMarks: 3.5,
		averagePercent: 70,
		gradedCount: 3,
		totalCount: 4,
		completionPercent: 75,
		details: {
			label: "Correctness",
			description: "Checks final correctness",
			kind: "check" as const,
			properties: { kind: "check" as const, trueMarks: 5, falseMarks: 0 },
		},
	},
	{
		criterionId: "r-explanation",
		rubricId: "q2",
		rubricLabel: "Rubric 2",
		maxMarks: 4,
		averageMarks: 1.2,
		averagePercent: 30,
		gradedCount: 2,
		totalCount: 4,
		completionPercent: 50,
		details: {
			label: "Explanation quality",
			description: "Quality and structure of explanation",
			kind: "options" as const,
			properties: {
				kind: "options" as const,
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

const meta = {
	title: "Grade/CriterionAnalyticsTable",
	component: CriterionAnalyticsTable,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: { criteria },
} satisfies Meta<typeof CriterionAnalyticsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Partial: Story = {};

export const Empty: Story = { args: { criteria: [] } };

export const LowAverage: Story = {
	args: {
		criteria: criteria.map((row) =>
			row.criterionId === "r-explanation"
				? { ...row, averageMarks: 0.8, averagePercent: 20 }
				: row,
		),
	},
};

export const Complete: Story = {
	args: {
		criteria: criteria.map((row) => ({
			...row,
			gradedCount: row.totalCount,
			completionPercent: 100,
		})),
	},
};
