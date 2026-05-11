import { Grid } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { fn } from "storybook/test";
import RubricGradeRow from "./RubricGradeRow";

const meta = {
  title: "Rubrics/RubricGradeRow",
  component: RubricGradeRow,
  tags: ["autodocs"],
  args: {
    onGrade: fn(),
    disabled: false,
    isPending: false,
  },
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
      label: "Correct answer",
      description: "The student provided the correct final answer.",
    },
  },
};

export const BooleanGraded: Story = {
  args: {
    rubric: {
      id: "r1",
      type: "boolean",
      marks: 2,
      label: "Correct answer",
      description: "The student provided the correct final answer.",
      grading: true,
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
      label: "Correct answer",
      grading: true,
    },
  },
};

export const NumericalUnset: Story = {
  args: {
    rubric: {
      id: "r2",
      type: "numerical",
      min: 0,
      max: 5,
      label: "Quality of explanation",
      description: "Rate the quality of the student's explanation from 0 to 5.",
    },
  },
};

export const NumericalGraded: Story = {
  args: {
    rubric: {
      id: "r2",
      type: "numerical",
      min: 0,
      max: 5,
      label: "Quality of explanation",
      description: "Rate the quality of the student's explanation from 0 to 5.",
      grading: 3,
    },
  },
};

export const OrdinalUnset: Story = {
  args: {
    rubric: {
      id: "r3",
      type: "ordinal",
      values: { Excellent: 4, Good: 3, Satisfactory: 2, Poor: 1 },
      label: "Overall performance",
    },
  },
};

export const OrdinalGraded: Story = {
  args: {
    rubric: {
      id: "r3",
      type: "ordinal",
      values: { Excellent: 4, Good: 3, Satisfactory: 2, Poor: 1 },
      label: "Overall performance",
      grading: "Good",
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
      label: "Read-only rubric",
      grading: false,
    },
  },
};
