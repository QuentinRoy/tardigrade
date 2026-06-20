import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent } from "storybook/test";
import NumberField from "./NumberField.tsx";

const onCommit = fn();

function ControlledNumberField({
	label,
	initialValue,
	error,
}: {
	label: string;
	initialValue: number;
	error?: string | undefined;
}) {
	const [value, setValue] = useState(initialValue);
	return (
		<NumberField
			label={label}
			value={value}
			onChange={(next) => {
				onCommit(next);
				setValue(next);
			}}
			error={error}
		/>
	);
}

const meta = {
	title: "Shared/NumberField",
	component: ControlledNumberField,
	args: { label: "Marks", initialValue: 1 },
	beforeEach: () => {
		onCommit.mockClear();
	},
} satisfies Meta<typeof ControlledNumberField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TypesNegativeNumber: Story = {
	play: async () => {
		const input = screen.getByLabelText<HTMLInputElement>("Marks");
		await userEvent.clear(input);
		await userEvent.type(input, "-5");

		await expect(input.value).toBe("-5");
		await expect(onCommit).toHaveBeenLastCalledWith(-5);
	},
};

export const TypesDecimalNumber: Story = {
	play: async () => {
		const input = screen.getByLabelText<HTMLInputElement>("Marks");
		await userEvent.clear(input);
		await userEvent.type(input, "0.5");

		await expect(input.value).toBe("0.5");
		await expect(onCommit).toHaveBeenLastCalledWith(0.5);
	},
};

export const TypesNegativeDecimalNumber: Story = {
	play: async () => {
		const input = screen.getByLabelText<HTMLInputElement>("Marks");
		await userEvent.clear(input);
		await userEvent.type(input, "-2.25");

		await expect(input.value).toBe("-2.25");
		await expect(onCommit).toHaveBeenLastCalledWith(-2.25);
	},
};

// Regression for #68: clearing the field must not coerce the empty string to 0
// (the old controlled field parsed `Number("")` on every keystroke). Instead it
// reports NaN so the invalid edit is rejected with an error at form submission
// rather than silently keeping the last valid value.
export const ClearingReportsInvalidValue: Story = {
	play: async () => {
		const input = screen.getByLabelText<HTMLInputElement>("Marks");
		await userEvent.clear(input);

		await expect(input.value).toBe("");
		await expect(onCommit).not.toHaveBeenCalledWith(0);
		await expect(onCommit).toHaveBeenLastCalledWith(Number.NaN);
	},
};

export const DisplaysSubmitError: Story = {
	args: { error: "Marks must be a valid number" },
	play: async () => {
		await expect(
			screen.getByText("Marks must be a valid number"),
		).toBeVisible();
	},
};
