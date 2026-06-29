import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import StudentMatrix from "./StudentMatrix.tsx";

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

const students = [
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
	title: "Assessment/StudentMatrix",
	component: StudentMatrix,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: { rubrics, students },
} satisfies Meta<typeof StudentMatrix>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Partial: Story = {};

export const Empty: Story = { args: { rubrics: [], students: [] } };

export const Complete: Story = {
	args: {
		students: students.map((student) => ({
			...student,
			completedRubrics: student.totalRubrics,
			rubrics: student.rubrics.map((cell) => ({
				...cell,
				assessed: true,
				marks: cell.marks ?? 2,
			})),
			marks: student.maxMarks,
		})),
	},
};
