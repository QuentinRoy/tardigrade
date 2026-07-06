import { Box, Progress, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";

type CompletionProgressProps = {
	assessedCount: number;
	totalCount: number;
	completionPercent: number;
	width?: number;
	alignItems?: "flex-start" | "center" | "flex-end";
};

export default function CompletionProgress({
	assessedCount,
	totalCount,
	completionPercent,
	width = 120,
	alignItems = "center",
}: CompletionProgressProps): ReactElement {
	return (
		<Stack gap="xs" align={alignItems}>
			<Text size="xs" style={{ whiteSpace: "nowrap" }}>
				{assessedCount} / {totalCount}
			</Text>
			<Box w={width}>
				<Progress value={completionPercent} size="sm" />
			</Box>
		</Stack>
	);
}
