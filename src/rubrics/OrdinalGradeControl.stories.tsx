import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import OrdinalGradeControl from "./OrdinalGradeControl";

const exampleValues = {
  Excellent: 4,
  Good: 3,
  Satisfactory: 2,
  Poor: 1,
  Absent: 0,
};

const meta = {
  title: "Rubrics/OrdinalGradeControl",
  component: OrdinalGradeControl,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    onGrade: fn(),
    disabled: false,
    values: exampleValues,
  },
} satisfies Meta<typeof OrdinalGradeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unset: Story = {};

export const Selected: Story = {
  args: { grading: "Good" },
};

export const Disabled: Story = {
  args: { grading: "Satisfactory", disabled: true },
};

export const TwoValues: Story = {
  args: {
    values: { Pass: 1, Fail: 0 },
  },
};
