import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import BooleanGradeControl from "./BooleanGradeControl";

const meta = {
  title: "Rubrics/BooleanGradeControl",
  component: BooleanGradeControl,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    onGrade: fn(),
    disabled: false,
  },
} satisfies Meta<typeof BooleanGradeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unset: Story = {};

export const True: Story = {
  args: { grading: true },
};

export const False: Story = {
  args: { grading: false },
};

export const Disabled: Story = {
  args: { grading: true, disabled: true },
};
