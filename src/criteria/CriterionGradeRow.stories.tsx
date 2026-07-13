import { Stack } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";
import { fn } from "storybook/test";
import CriterionGradeRow from "./CriterionGradeRow.tsx";

const meta = {
	title: "Criteria/CriterionGradeRow",
	component: CriterionGradeRow,
	tags: ["autodocs"],
	args: { onGrade: fn(), disabled: false, isPending: false },
	decorators: [
		(Story): ReactElement => (
			<Stack gap="xs">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof CriterionGradeRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CheckUnset: Story = {
	args: {
		criterion: {
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: 0,
			label: "Correct answer",
			description: "The student provided the correct final answer.",
			grade: null,
		},
	},
};

export const CheckGraded: Story = {
	args: {
		criterion: {
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: -1,
			label: "Correct answer",
			description: "The student provided the correct final answer.",
			grade: { passed: true },
		},
	},
};

export const CheckPending: Story = {
	args: {
		isPending: true,
		criterion: {
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: 0,
			label: "Correct answer",
			grade: { passed: true },
		},
	},
};

export const CheckZeroMaxUnset: Story = {
	args: {
		criterion: {
			id: "r1",
			kind: "check",
			marks: 0,
			falseMarks: -1,
			label: "Penalty only",
			description: "No marks for passing; penalty for failing. Shows (?/-1).",
			grade: null,
		},
	},
};

export const CheckZeroMaxGraded: Story = {
	args: {
		criterion: {
			id: "r1",
			kind: "check",
			marks: 0,
			falseMarks: -1,
			label: "Penalty only",
			description: "No marks for passing; penalty for failing. Shows (0/-1).",
			grade: { passed: true },
		},
	},
};

export const NumberUnset: Story = {
	args: {
		criterion: {
			id: "r2",
			kind: "number",
			minScore: 0,
			maxScore: 5,
			minMarks: 0,
			maxMarks: 5,
			label: "Quality of explanation",
			description: "Rate the quality of the student's explanation from 0 to 5.",
			reversed: false,
			grade: null,
		},
	},
};

export const NumberGraded: Story = {
	args: {
		criterion: {
			id: "r2",
			kind: "number",
			minScore: 0,
			maxScore: 5,
			minMarks: 0,
			maxMarks: 5,
			label: "Quality of explanation",
			description: "Rate the quality of the student's explanation from 0 to 5.",
			reversed: false,
			grade: { score: 3 },
		},
	},
};

export const OptionsUnset: Story = {
	args: {
		criterion: {
			id: "r3",
			kind: "options",
			marks: { Excellent: 4, Good: 3, Satisfactory: 2, Poor: 1 },
			label: "Overall performance",
			grade: null,
		},
	},
};

export const OptionsGraded: Story = {
	args: {
		criterion: {
			id: "r3",
			kind: "options",
			marks: { Excellent: 4, Good: 3, Satisfactory: 2, Poor: 1 },
			label: "Overall performance",
			grade: { selectedLabel: "Good" },
		},
	},
};

export const Disabled: Story = {
	args: {
		disabled: true,
		criterion: {
			id: "r1",
			kind: "check",
			marks: 1,
			falseMarks: 0,
			label: "Read-only criterion",
			grade: { passed: false },
		},
	},
};

export const WithoutDescription: Story = {
	args: {
		criterion: {
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: 0,
			label: "Correct answer",
			grade: null,
		},
	},
};
