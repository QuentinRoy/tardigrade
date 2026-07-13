import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CompletionSummary from "./CompletionSummary.tsx";

const meta = {
	title: "Grade/CompletionSummary",
	component: CompletionSummary,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { marks: 7, maxMarks: 10, completedCriteria: 2, totalCriteria: 3 },
} satisfies Meta<typeof CompletionSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const AlmostDone: Story = {
	args: { marks: 13, maxMarks: 15, completedCriteria: 5, totalCriteria: 6 },
};

export const Completed: Story = {
	args: { marks: 15, maxMarks: 15, completedCriteria: 6, totalCriteria: 6 },
};

export const Empty: Story = {
	args: { marks: 0, maxMarks: 0, completedCriteria: 0, totalCriteria: 0 },
};
