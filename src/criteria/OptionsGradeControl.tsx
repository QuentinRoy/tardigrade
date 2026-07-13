"use client";

import { Group, SegmentedControl, Text } from "@mantine/core";
import type { ReactElement } from "react";

type OptionsGradeControlProps = {
	value?: string | undefined;
	marks: Record<string, number>;
	disabled: boolean;
	onGrade: (value: string) => void;
};

export default function OptionsGradeControl({
	value,
	marks,
	disabled,
	onGrade,
}: OptionsGradeControlProps): ReactElement {
	return (
		<SegmentedControl
			aria-label="Options criterion grade"
			value={value ?? ""}
			onChange={onGrade}
			disabled={disabled}
			orientation="vertical"
			data={Object.entries(marks).map(([valueLabel, valueScore]) => ({
				value: valueLabel,
				label: (
					<Group justify="space-between" wrap="nowrap" gap="sm" miw={0}>
						<Text truncate="end" miw={0}>
							{valueLabel}
						</Text>
						<Text c="dimmed" flex="0 0 auto">
							({valueScore})
						</Text>
					</Group>
				),
			}))}
		/>
	);
}
