import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import RubricAnalyticsTable from "./RubricAnalyticsTable.tsx";

const rubrics = [
	{
		rubricId: "r-correctness",
		questionId: "q1",
		questionLabel: "Question 1",
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
		rubricId: "r-explanation",
		questionId: "q2",
		questionLabel: "Question 2",
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

const meta = {
	title: "Assessment/RubricAnalyticsTable",
	component: RubricAnalyticsTable,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: { rubrics },
} satisfies Meta<typeof RubricAnalyticsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Partial: Story = {};

export const Empty: Story = { args: { rubrics: [] } };

export const LowAverage: Story = {
	args: {
		rubrics: rubrics.map((row) =>
			row.rubricId === "r-explanation"
				? { ...row, averageMarks: 0.8, averagePercent: 20 }
				: row,
		),
	},
};

export const Complete: Story = {
	args: {
		rubrics: rubrics.map((row) => ({
			...row,
			assessedCount: row.totalCount,
			completionPercent: 100,
		})),
	},
};
