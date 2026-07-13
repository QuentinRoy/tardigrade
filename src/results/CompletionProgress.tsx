import { Box, Progress, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";

type CompletionProgressProps = {
	gradedCount: number;
	totalCount: number;
	completionPercent: number;
	width?: number;
	alignItems?: "flex-start" | "center" | "flex-end";
};

export default function CompletionProgress({
	gradedCount,
	totalCount,
	completionPercent,
	width = 120,
	alignItems = "center",
}: CompletionProgressProps): ReactElement {
	return (
		<Stack gap="xs" align={alignItems}>
			<Text size="xs" style={{ whiteSpace: "nowrap" }}>
				{gradedCount} / {totalCount}
			</Text>
			<Box w={width}>
				<Progress value={completionPercent} size="sm" />
			</Box>
		</Stack>
	);
}
