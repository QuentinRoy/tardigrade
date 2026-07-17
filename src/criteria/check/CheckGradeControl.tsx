"use client";

import { Group, SegmentedControl, Text } from "@mantine/core";
import type { ReactElement } from "react";

type CheckGradeControlProps = {
	value?: boolean | undefined;
	marks: number;
	falseMarks: number;
	disabled: boolean;
	onGrade: (value: boolean) => void;
};

const UNSET = "";

type AnswerLabelProps = { text: string; marks: number };

function AnswerLabel({ text, marks }: AnswerLabelProps): ReactElement {
	return (
		<Group justify="space-between" wrap="nowrap" gap="sm" miw={0}>
			<Text truncate="end" miw={0}>
				{text}
			</Text>
			<Text c="dimmed" flex="0 0 auto">
				({marks})
			</Text>
		</Group>
	);
}

export default function CheckGradeControl({
	value,
	marks,
	falseMarks,
	disabled,
	onGrade,
}: CheckGradeControlProps): ReactElement {
	return (
		<SegmentedControl<"true" | "false" | typeof UNSET>
			aria-label="Check criterion grade"
			value={value == null ? UNSET : value ? "true" : "false"}
			onChange={(next) => onGrade(next === "true")}
			disabled={disabled}
			data={[
				{ value: "true", label: <AnswerLabel text="Yes" marks={marks} /> },
				{ value: "false", label: <AnswerLabel text="No" marks={falseMarks} /> },
			]}
		/>
	);
}
