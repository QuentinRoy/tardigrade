import { Progress, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";

type CompletionSummaryProps = {
	marks: number;
	maxMarks: number;
	completedCriteria: number;
	totalCriteria: number;
};

export default function CompletionSummary({
	marks,
	maxMarks,
	completedCriteria,
	totalCriteria,
}: CompletionSummaryProps): ReactElement {
	const safeCompletedCriteria = Math.max(
		0,
		Math.min(completedCriteria, totalCriteria),
	);
	const criteriaLeft = Math.max(0, totalCriteria - safeCompletedCriteria);
	const progressValue =
		totalCriteria > 0 ? (safeCompletedCriteria / totalCriteria) * 100 : 0;
	const isCompleted = totalCriteria > 0 && criteriaLeft === 0;

	return (
		<Stack align="center" gap="xs">
			<Text>
				<span>{marks}</span>&nbsp;/&nbsp;{maxMarks}
			</Text>
			<Progress
				value={progressValue}
				color={isCompleted ? "green" : "gray"}
				size="sm"
				w="100%"
				maw={280}
			/>
			<Text size="xs" c="dimmed">
				{isCompleted
					? "(completed)"
					: `(${criteriaLeft} criterion${criteriaLeft !== 1 ? "s" : ""} left)`}
			</Text>
		</Stack>
	);
}
