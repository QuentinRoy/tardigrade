"use client";

import { NumberInput } from "@mantine/core";
import { type ReactElement, useRef } from "react";
import { clamp } from "#utils/utils.ts";

type NumberGradeControlProps = {
	value?: number | undefined;
	minValue: number;
	maxValue: number;
	disabled: boolean;
	onGrade: (value: number) => void;
};

export default function NumberGradeControl({
	value,
	minValue,
	maxValue,
	disabled,
	onGrade,
}: NumberGradeControlProps): ReactElement {
	const ref = useRef<HTMLInputElement>(null);
	const lastValueRef = useRef(value);

	function submit(text: string) {
		const trimmed = text.trim();
		const parsedValue = trimmed.length === 0 ? Number.NaN : Number(trimmed);
		if (!Number.isFinite(parsedValue)) {
			if (ref.current != null) {
				ref.current.value = lastValueRef.current?.toString() ?? "";
			}
			return;
		}
		if (parsedValue === lastValueRef.current) {
			return;
		}
		const clampedValue = clamp({
			value: parsedValue,
			min: minValue,
			max: maxValue,
		});
		if (clampedValue !== parsedValue && ref.current != null) {
			ref.current.value = clampedValue.toString();
		}
		lastValueRef.current = clampedValue;
		onGrade(clampedValue);
	}

	return (
		<NumberInput
			ref={ref}
			defaultValue={value ?? ""}
			onBlur={(event) => submit(event.currentTarget.value)}
			placeholder="Value"
			clampBehavior="none"
			disabled={disabled}
			min={minValue}
			max={maxValue}
			allowDecimal
			w="90"
		/>
	);
}
