import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GlobalCompletionSummary from "./GlobalCompletionSummary.tsx";

const meta = {
	title: "Grade/GlobalCompletionSummary",
	component: GlobalCompletionSummary,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: {
		completion: {
			gradeTargets: { completed: 3, total: 10 },
			rubrics: { completed: 4, total: 12 },
			criteria: { completed: 120, total: 360 },
		},
	},
} satisfies Meta<typeof GlobalCompletionSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const AlmostDone: Story = {
	args: {
		completion: {
			gradeTargets: { completed: 9, total: 10 },
			rubrics: { completed: 11, total: 12 },
			criteria: { completed: 332, total: 360 },
		},
	},
};

export const Completed: Story = {
	args: {
		completion: {
			gradeTargets: { completed: 10, total: 10 },
			rubrics: { completed: 12, total: 12 },
			criteria: { completed: 360, total: 360 },
		},
	},
};

export const EmptyGrade: Story = {
	args: {
		completion: {
			gradeTargets: { completed: 0, total: 0 },
			rubrics: { completed: 0, total: 0 },
			criteria: { completed: 0, total: 0 },
		},
	},
};
