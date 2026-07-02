"use client";

import { NumberInput } from "@mantine/core";
import { type ReactElement, useRef } from "react";
import { clamp } from "#utils/utils.ts";

type NumericalGradeControlProps = {
	value?: number | undefined;
	minScore: number;
	maxScore: number;
	disabled: boolean;
	onAssess: (value: number) => void;
};

export default function NumericalGradeControl({
	value,
	minScore,
	maxScore,
	disabled,
	onAssess,
}: NumericalGradeControlProps): ReactElement {
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
			min: minScore,
			max: maxScore,
		});
		if (clampedValue !== parsedValue && ref.current != null) {
			ref.current.value = clampedValue.toString();
		}
		lastValueRef.current = clampedValue;
		onAssess(clampedValue);
	}

	return (
		<NumberInput
			ref={ref}
			defaultValue={value ?? ""}
			onBlur={(event) => submit(event.currentTarget.value)}
			placeholder="Score"
			clampBehavior="none"
			disabled={disabled}
			min={minScore}
			max={maxScore}
			allowDecimal
			w="90"
		/>
	);
}
