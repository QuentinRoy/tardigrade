import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
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
		<Box sx={{ mb: 2, textAlign: "center" }}>
			<Typography variant="subtitle1">
				<span>{marks}</span>&nbsp;/&nbsp;{maxMarks}
			</Typography>
			<Box sx={{ mt: 1, maxWidth: 280, mx: "auto" }}>
				<LinearProgress
					variant="determinate"
					value={progressValue}
					color={isCompleted ? "success" : "secondary"}
					sx={{ height: 6, borderRadius: 3 }}
				/>
			</Box>
			<Typography variant="caption" color="text.secondary">
				{isCompleted
					? "(completed)"
					: `(${rubricsLeft} rubric${rubricsLeft !== 1 ? "s" : ""} left)`}
			</Typography>
		</Box>
	);
}
