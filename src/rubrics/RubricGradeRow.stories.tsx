import { Grid } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";
import { fn } from "storybook/test";
import RubricGradeRow from "./RubricGradeRow";

const meta = {
	title: "Rubrics/RubricGradeRow",
	component: RubricGradeRow,
	tags: ["autodocs"],
	args: { onAssess: fn(), disabled: false, isPending: false },
	decorators: [
		(Story): ReactElement => (
			<Grid container spacing={1} sx={{ alignItems: "center" }}>
				<Story />
			</Grid>
		),
	],
} satisfies Meta<typeof RubricGradeRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BooleanUnset: Story = {
	args: {
		rubric: {
			id: "r1",
			type: "boolean",
			marks: 2,
			falseMarks: 0,
			label: "Correct answer",
			description: "The student provided the correct final answer.",
			assessment: null,
		},
	},
};

export const BooleanGraded: Story = {
	args: {
		rubric: {
			id: "r1",
			type: "boolean",
			marks: 2,
			falseMarks: -1,
			label: "Correct answer",
			description: "The student provided the correct final answer.",
			assessment: { passed: true },
		},
	},
};

export const BooleanPending: Story = {
	args: {
		isPending: true,
		rubric: {
			id: "r1",
			type: "boolean",
			marks: 2,
			falseMarks: 0,
			label: "Correct answer",
			assessment: { passed: true },
		},
	},
};

export const BooleanZeroMaxUnset: Story = {
	args: {
		rubric: {
			id: "r1",
			type: "boolean",
			marks: 0,
			falseMarks: -1,
			label: "Penalty only",
			description: "No marks for passing; penalty for failing. Shows (?/-1).",
			assessment: null,
		},
	},
};

export const BooleanZeroMaxGraded: Story = {
	args: {
		rubric: {
			id: "r1",
			type: "boolean",
			marks: 0,
			falseMarks: -1,
			label: "Penalty only",
			description: "No marks for passing; penalty for failing. Shows (0/-1).",
			assessment: { passed: true },
		},
	},
};

export const NumericalUnset: Story = {
	args: {
		rubric: {
			id: "r2",
			type: "numerical",
			minScore: 0,
			maxScore: 5,
			minMarks: 0,
			maxMarks: 5,
			label: "Quality of explanation",
			description: "Rate the quality of the student's explanation from 0 to 5.",
			reversed: false,
			assessment: null,
		},
	},
};

export const NumericalGraded: Story = {
	args: {
		rubric: {
			id: "r2",
			type: "numerical",
			minScore: 0,
			maxScore: 5,
			minMarks: 0,
			maxMarks: 5,
			label: "Quality of explanation",
			description: "Rate the quality of the student's explanation from 0 to 5.",
			reversed: false,
			assessment: { score: 3 },
		},
	},
};

export const OrdinalUnset: Story = {
	args: {
		rubric: {
			id: "r3",
			type: "ordinal",
			marks: { Excellent: 4, Good: 3, Satisfactory: 2, Poor: 1 },
			label: "Overall performance",
			assessment: null,
		},
	},
};

export const OrdinalGraded: Story = {
	args: {
		rubric: {
			id: "r3",
			type: "ordinal",
			marks: { Excellent: 4, Good: 3, Satisfactory: 2, Poor: 1 },
			label: "Overall performance",
			assessment: { selectedLabel: "Good" },
		},
	},
};

export const Disabled: Story = {
	args: {
		disabled: true,
		rubric: {
			id: "r1",
			type: "boolean",
			marks: 1,
			falseMarks: 0,
			label: "Read-only rubric",
			assessment: { passed: false },
		},
	},
};

export const WithoutDescription: Story = {
	args: {
		rubric: {
			id: "r1",
			type: "boolean",
			marks: 2,
			falseMarks: 0,
			label: "Correct answer",
			assessment: null,
		},
	},
};
