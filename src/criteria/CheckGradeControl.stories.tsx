import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import CheckGradeControl from "./CheckGradeControl.tsx";

const meta = {
	title: "Criteria/CheckGradeControl",
	component: CheckGradeControl,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { onGrade: fn(), disabled: false, marks: 1, falseMarks: 0 },
} satisfies Meta<typeof CheckGradeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unset: Story = {};

export const Yes: Story = { args: { value: true } };

export const No: Story = { args: { value: false } };

export const Disabled: Story = { args: { value: true, disabled: true } };

export const Reversed: Story = {
	args: { marks: 0, falseMarks: 1, value: true },
};
