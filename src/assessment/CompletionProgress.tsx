import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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
		<Stack sx={{ gap: 0.75, alignItems }}>
			<Typography variant="caption" sx={{ whiteSpace: "nowrap" }}>
				{assessedCount} / {totalCount}
			</Typography>
			<Box sx={{ width }}>
				<LinearProgress
					variant="determinate"
					value={completionPercent}
					color="secondary"
					sx={{ height: 6, borderRadius: 3 }}
				/>
			</Box>
		</Stack>
	);
}
