import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AssessmentProgressSummary from "./AssessmentProgressSummary.tsx";

const meta = {
	title: "Assessment/AssessmentProgressSummary",
	component: AssessmentProgressSummary,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { marks: 7, maxMarks: 10, completedRubrics: 2, totalRubrics: 3 },
} satisfies Meta<typeof AssessmentProgressSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const AlmostDone: Story = {
	args: { marks: 13, maxMarks: 15, completedRubrics: 5, totalRubrics: 6 },
};

export const Completed: Story = {
	args: { marks: 15, maxMarks: 15, completedRubrics: 6, totalRubrics: 6 },
};

export const Empty: Story = {
	args: { marks: 0, maxMarks: 0, completedRubrics: 0, totalRubrics: 0 },
};
