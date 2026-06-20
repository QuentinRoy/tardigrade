import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { AssessmentCompletionSummary } from "./types.ts";

type GlobalAssessmentSummaryProps = { progress: AssessmentCompletionSummary };

type MetricCardProps = {
	title: string;
	helper: string;
	completed: number;
	total: number;
};

function MetricCard({
	title,
	helper,
	completed,
	total,
}: MetricCardProps): ReactElement {
	const safeCompleted = Math.max(0, Math.min(completed, total));
	const percent = total > 0 ? (safeCompleted / total) * 100 : 0;

	return (
		<Paper
			variant="outlined"
			// Group the metric under its title so it has a single accessible name
			// (assistive tech and tests can target "Submissions assessed" etc.).
			role="group"
			aria-label={title}
			sx={{
				p: 2,
				display: "flex",
				flexDirection: "column",
				gap: 1,
				minWidth: { xs: "100%", sm: 220 },
				flex: "1 1 220px",
			}}
		>
			<Typography variant="subtitle2">{title}</Typography>
			<Typography variant="h5">
				{safeCompleted}&nbsp;/&nbsp;{total}
			</Typography>
			<LinearProgress
				variant="determinate"
				value={percent}
				sx={{ height: 8, borderRadius: 4 }}
			/>
			<Typography variant="caption" color="text.secondary">
				{helper}
			</Typography>
		</Paper>
	);
}

export default function GlobalAssessmentSummary({
	progress,
}: GlobalAssessmentSummaryProps): ReactElement {
	return (
		<Box sx={{ my: 3 }}>
			<Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
				<MetricCard
					title="Rubrics assessed"
					helper="Saved rubric assessments across all submissions"
					completed={progress.rubrics.completed}
					total={progress.rubrics.total}
				/>
				<MetricCard
					title="Questions assessed"
					helper="Fully assessed across all submissions"
					completed={progress.questions.completed}
					total={progress.questions.total}
				/>
				<MetricCard
					title="Submissions assessed"
					helper="Fully assessed across all questions"
					completed={progress.submissions.completed}
					total={progress.submissions.total}
				/>
			</Box>
		</Box>
	);
}
