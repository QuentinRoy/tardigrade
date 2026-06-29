import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SubmissionMatrix from "./SubmissionMatrix.tsx";

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

const submissionRows = [
	{
		submissionId: "1",
		submissionLabel: "Alice A",
		marks: 7.5,
		maxMarks: 9,
		averagePercent: 83.3,
		completedRubrics: 2,
		totalRubrics: 2,
		rubrics: [
			{ rubricId: "r-correctness", marks: 5, maxMarks: 5, assessed: true },
			{ rubricId: "r-explanation", marks: 2.5, maxMarks: 4, assessed: true },
		],
	},
	{
		submissionId: "2",
		submissionLabel: "Bob B",
		marks: 2,
		maxMarks: 5,
		averagePercent: 40,
		completedRubrics: 1,
		totalRubrics: 2,
		rubrics: [
			{ rubricId: "r-correctness", marks: 2, maxMarks: 5, assessed: true },
			{ rubricId: "r-explanation", marks: null, maxMarks: 4, assessed: false },
		],
	},
];

const meta = {
	title: "Assessment/SubmissionMatrix",
	component: SubmissionMatrix,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: { rubrics, submissionRows },
} satisfies Meta<typeof SubmissionMatrix>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Partial: Story = {};

export const Empty: Story = { args: { rubrics: [], submissionRows: [] } };

export const Complete: Story = {
	args: {
		submissionRows: submissionRows.map((submissionRow) => ({
			...submissionRow,
			completedRubrics: submissionRow.totalRubrics,
			rubrics: submissionRow.rubrics.map((cell) => ({
				...cell,
				assessed: true,
				marks: cell.marks ?? 2,
			})),
			marks: submissionRow.maxMarks,
		})),
	},
};
