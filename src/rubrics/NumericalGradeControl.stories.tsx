import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import NumericalGradeControl from "./NumericalGradeControl.tsx";

const meta = {
	title: "Rubrics/NumericalGradeControl",
	component: NumericalGradeControl,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { onAssess: fn(), disabled: false, minScore: 0, maxScore: 10 },
} satisfies Meta<typeof NumericalGradeControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unset: Story = {};

export const WithValue: Story = { args: { value: 7 } };

export const AtMin: Story = { args: { value: 0 } };

export const AtMax: Story = { args: { value: 10 } };

export const Disabled: Story = { args: { value: 5, disabled: true } };

// Regression: clearing the field and blurring must restore the last score
// rather than leaving the control empty.
export const ClearingRevertsToLastScore: Story = {
	args: { value: 7 },
	play: async ({ args }) => {
		const input = screen.getByRole("textbox");

		await userEvent.clear(input);
		await userEvent.tab();

		await waitFor(() => {
			expect(input).toHaveValue("7");
		});
		expect(args.onAssess).not.toHaveBeenCalled();
	},
};
