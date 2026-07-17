import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import OptionsGradeControl from "./OptionsGradeControl.tsx";

const exampleMarks = {
	Excellent: 4,
	Good: 3,
	Satisfactory: 2,
	Poor: 1,
	Absent: 0,
};

const meta = {
	title: "Criteria/OptionsGradeControl",
	component: OptionsGradeControl,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { onGrade: fn(), disabled: false, marks: exampleMarks },
} satisfies Meta<typeof OptionsGradeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unset: Story = {};

export const Selected: Story = { args: { value: "Good" } };

export const Disabled: Story = {
	args: { value: "Satisfactory", disabled: true },
};

export const TwoValues: Story = { args: { marks: { Pass: 1, Fail: 0 } } };
