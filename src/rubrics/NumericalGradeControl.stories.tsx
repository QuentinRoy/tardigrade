import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import NumericalGradeControl from "./NumericalGradeControl";

const meta = {
  title: "Rubrics/NumericalGradeControl",
  component: NumericalGradeControl,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    onGrade: fn(),
    disabled: false,
    minScore: 0,
    maxScore: 10,
  },
} satisfies Meta<typeof NumericalGradeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unset: Story = {};

export const WithValue: Story = {
  args: { grading: 7 },
};

export const AtMin: Story = {
  args: { grading: 0 },
};

export const AtMax: Story = {
  args: { grading: 10 },
};

export const Disabled: Story = {
  args: { grading: 5, disabled: true },
};
