import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import BooleanGradeControl from "./BooleanGradeControl";

const meta = {
	title: "Rubrics/BooleanGradeControl",
	component: BooleanGradeControl,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { onAssess: fn(), disabled: false },
} satisfies Meta<typeof BooleanGradeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unset: Story = {};

export const True: Story = { args: { value: true } };

export const False: Story = { args: { value: false } };

export const Disabled: Story = { args: { value: true, disabled: true } };
