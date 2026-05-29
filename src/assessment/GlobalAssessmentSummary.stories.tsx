import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GlobalAssessmentSummary from "./GlobalAssessmentSummary";

const meta = {
	title: "Assessment/GlobalAssessmentSummary",
	component: GlobalAssessmentSummary,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: {
		progress: {
			submissions: { completed: 3, total: 10 },
			questions: { completed: 4, total: 12 },
			rubrics: { completed: 120, total: 360 },
		},
	},
} satisfies Meta<typeof GlobalAssessmentSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const AlmostDone: Story = {
	args: {
		progress: {
			submissions: { completed: 9, total: 10 },
			questions: { completed: 11, total: 12 },
			rubrics: { completed: 332, total: 360 },
		},
	},
};

export const Completed: Story = {
	args: {
		progress: {
			submissions: { completed: 10, total: 10 },
			questions: { completed: 12, total: 12 },
			rubrics: { completed: 360, total: 360 },
		},
	},
};

export const EmptyAssessment: Story = {
	args: {
		progress: {
			submissions: { completed: 0, total: 0 },
			questions: { completed: 0, total: 0 },
			rubrics: { completed: 0, total: 0 },
		},
	},
};
