"use client";

import { NumberInput } from "@mantine/core";
import type { ReactElement } from "react";

type ScoreInputProps = {
	label: string;
	defaultValue: number;
	onChange: (value: number) => void;
	error?: string | undefined;
};

/**
 * Uncontrolled numeric input. The browser owns the field text while the user
 * types, so intermediate states like `-`, `-0`, `1.`, and `0.` are preserved
 * instead of being parsed and overwritten on every keystroke. `defaultValue`
 * is read once on mount; later changes to it do not update the displayed text.
 *
 * Every change reports a value through `onChange`, including `NaN` for an
 * empty or not-yet-numeric draft, so the submitted payload reflects exactly
 * what is in the field — an empty field must not silently fall back to the
 * last valid value. `NaN` serializes to `null` in the submitted JSON, which
 * the rubric schema rejects with a field-level error; pass that error back
 * in via `error` to display it.
 */
export default function ScoreInput({
	label,
	defaultValue,
	onChange,
	error,
}: ScoreInputProps): ReactElement {
	return (
		<NumberInput
			label={label}
			defaultValue={Number.isFinite(defaultValue) ? defaultValue : ""}
			onChange={(value) => {
				if (typeof value === "number") {
					onChange(value);
					return;
				}
				const text = value.trim();
				const parsed = text.length > 0 ? Number(text) : Number.NaN;
				onChange(Number.isFinite(parsed) ? parsed : Number.NaN);
			}}
			error={error}
			allowDecimal
		/>
	);
}
