"use client";

import TextField from "@mui/material/TextField";
import type { ReactElement } from "react";

type NumberFieldProps = {
	label: string;
	value: number;
	onChange: (value: number) => void;
	error?: string | undefined;
};

/**
 * Uncontrolled numeric input. The browser owns the field text while the user
 * types, so intermediate states like `-`, `-0`, `1.`, and `0.` are preserved
 * instead of being parsed and overwritten on every keystroke.
 *
 * Every change reports a value through `onChange`, including `NaN` for an
 * empty or not-yet-numeric draft, so the submitted payload reflects exactly
 * what is in the field — an empty field must not silently fall back to the
 * last valid value. `NaN` serializes to `null` in the submitted JSON, which
 * the question schema rejects with a field-level error; pass that error back
 * in via `error` to display it.
 */
export default function NumberField({
	label,
	value,
	onChange,
	error,
}: NumberFieldProps): ReactElement {
	return (
		<TextField
			label={label}
			type="number"
			defaultValue={Number.isFinite(value) ? value : ""}
			onChange={(event) => {
				const text = event.target.value.trim();
				const parsed = Number(text);
				const isValidNumber = text.length > 0 && Number.isFinite(parsed);
				onChange(isValidNumber ? parsed : Number.NaN);
			}}
			error={error != null}
			helperText={error ?? ""}
			size="small"
		/>
	);
}
