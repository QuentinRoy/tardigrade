import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { RubricOverviewRow } from "@/db/rubricOverviewBuilder";
import CompletionProgress from "./CompletionProgress";
import QuestionDetailsTooltip from "./QuestionDetailsTooltip";
import RubricDetailsTooltip from "./RubricDetailsTooltip";

type RubricAnalyticsTableProps = { rubrics: RubricOverviewRow[] };

function formatMarks(value: number | null): string {
	if (value == null || Number.isNaN(value)) {
		return "-";
	}

	return value.toFixed(1).replace(/\.0$/, "");
}

function severityColor(percent: number | null): string {
	if (percent == null || Number.isNaN(percent)) {
		return "hsl(220 8% 60%)";
	}

	const clamped = Math.max(0, Math.min(percent, 100));
	const hue = Math.max(0, Math.min(120, clamped * 1.2));
	return `hsl(${hue} 70% 42%)`;
}

export default function RubricAnalyticsTable({
	rubrics,
}: RubricAnalyticsTableProps): ReactElement {
	return (
		<TableContainer component={Paper} variant="outlined">
			<Table size="small" aria-label="Rubric analytics">
				<TableHead>
					<TableRow>
						<TableCell>Question</TableCell>
						<TableCell>Rubric</TableCell>
						<TableCell align="center">Average</TableCell>
						<TableCell align="right">Completion</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{rubrics.map((rubric) => {
						const color = severityColor(rubric.averagePercent);

						return (
							<TableRow key={rubric.rubricId}>
								<TableCell>
									<QuestionDetailsTooltip
										questionId={rubric.questionId}
										questionLabel={rubric.questionLabel}
									/>
								</TableCell>
								<TableCell>
									<RubricDetailsTooltip
										rubricId={rubric.rubricId}
										details={rubric.details}
									/>
								</TableCell>
								<TableCell align="center">
									<Box
										sx={{
											display: "inline-flex",
											alignItems: "start",
											borderRadius: 1,
											px: 1,
											py: 0.5,
											bgcolor: alpha(color, 0.1),
										}}
									>
										<Typography
											variant="body2"
											sx={{ color, whiteSpace: "nowrap" }}
										>
											{formatMarks(rubric.averageMarks)} /{" "}
											{formatMarks(rubric.maxMarks)}
										</Typography>
									</Box>
								</TableCell>
								<TableCell sx={{ minWidth: 180 }}>
									<CompletionProgress
										assessedCount={rubric.assessedCount}
										totalCount={rubric.totalCount}
										completionPercent={rubric.completionPercent}
										alignItems="flex-end"
									/>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
