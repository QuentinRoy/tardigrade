import { Progress, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";

type AssessmentProgressSummaryProps = {
	marks: number;
	maxMarks: number;
	completedRubrics: number;
	totalRubrics: number;
};

export default function AssessmentProgressSummary({
	marks,
	maxMarks,
	completedRubrics,
	totalRubrics,
}: AssessmentProgressSummaryProps): ReactElement {
	const safeCompletedRubrics = Math.max(
		0,
		Math.min(completedRubrics, totalRubrics),
	);
	const rubricsLeft = Math.max(0, totalRubrics - safeCompletedRubrics);
	const progressValue =
		totalRubrics > 0 ? (safeCompletedRubrics / totalRubrics) * 100 : 0;
	const isCompleted = totalRubrics > 0 && rubricsLeft === 0;

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
					: `(${rubricsLeft} rubric${rubricsLeft !== 1 ? "s" : ""} left)`}
			</Text>
		</Stack>
	);
}
