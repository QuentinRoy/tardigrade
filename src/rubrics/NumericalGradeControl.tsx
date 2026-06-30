"use client";

import { NumberInput } from "@mantine/core";
import { type ReactElement, useRef } from "react";
import { clamped } from "#utils/utils.ts";

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
	function submit(text: string) {
		const trimmed = text.trim();
		if (trimmed.length === 0) {
			return;
		}
		const parsedValue = Number(trimmed);
		if (!Number.isFinite(parsedValue) || parsedValue === value) {
			return;
		}
		const clampedValue = clamped({
			value: parsedValue,
			min: minScore,
			max: maxScore,
		});
		if (clampedValue !== parsedValue && ref.current != null) {
			ref.current.value = clampedValue.toString();
		}
		onAssess(clampedValue);
	}

	return (
		<NumberInput
			ref={ref}
			defaultValue={value ?? ""}
			onBlur={(v) => submit(v.target.value)}
			placeholder="Score"
			clampBehavior="none"
			disabled={disabled}
			min={minScore}
			max={maxScore}
			allowDecimal
			w="80"
		/>
	);
}
