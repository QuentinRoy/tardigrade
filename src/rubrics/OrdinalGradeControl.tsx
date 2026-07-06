"use client";

import { Group, SegmentedControl, Text } from "@mantine/core";
import type { ReactElement } from "react";

type OrdinalGradeControlProps = {
	value?: string | undefined;
	marks: Record<string, number>;
	disabled: boolean;
	onAssess: (value: string) => void;
};

export default function OrdinalGradeControl({
	value,
	marks,
	disabled,
	onAssess,
}: OrdinalGradeControlProps): ReactElement {
	return (
		<SegmentedControl
			aria-label="Ordinal rubric assessment"
			value={value ?? ""}
			onChange={onAssess}
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
