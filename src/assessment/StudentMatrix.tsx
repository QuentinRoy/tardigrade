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
import type {
	RubricOverviewRow,
	RubricOverviewStudentRow,
} from "@/db/rubricOverviewBuilder";
import CompletionProgress from "./CompletionProgress";
import RubricDetailsTooltip from "./RubricDetailsTooltip";

type StudentMatrixProps = {
	rubrics: RubricOverviewRow[];
	students: RubricOverviewStudentRow[];
};

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

export default function StudentMatrix({
	rubrics,
	students,
}: StudentMatrixProps): ReactElement {
	return (
		<TableContainer component={Paper} variant="outlined">
			<Table size="small" aria-label="Student matrix">
				<TableHead>
					<TableRow>
						<TableCell>Submission</TableCell>
						{rubrics.map((rubric) => (
							<TableCell key={rubric.rubricId} align="center">
								<RubricDetailsTooltip
									rubricId={rubric.rubricId}
									details={rubric.details}
								/>
							</TableCell>
						))}
						<TableCell align="center">Average</TableCell>
						<TableCell align="right">Completion</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{students.map((student) => (
						<TableRow key={student.submissionId}>
							<TableCell>{student.submissionLabel}</TableCell>
							{student.rubrics.map((rubricCell) => {
								const color = rubricCell.assessed
									? severityColor(
											rubricCell.maxMarks > 0
												? ((rubricCell.marks ?? 0) / rubricCell.maxMarks) * 100
												: 0,
										)
									: "hsl(220 8% 60%)";

								return (
									<TableCell key={rubricCell.rubricId} align="center">
										<Box
											sx={{
												display: "inline-flex",
												borderRadius: 1,
												px: 0.75,
												py: 0.25,
												bgcolor: alpha(
													color,
													rubricCell.assessed ? 0.12 : 0.08,
												),
												color,
												minWidth: 64,
												justifyContent: "center",
											}}
										>
											<Typography
												variant="caption"
												sx={{ whiteSpace: "nowrap" }}
											>
												{rubricCell.assessed
													? `${formatMarks(rubricCell.marks)} / ${formatMarks(rubricCell.maxMarks)}`
													: "-"}
											</Typography>
										</Box>
									</TableCell>
								);
							})}
							<TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
								<Box
									sx={{
										display: "inline-flex",
										alignItems: "center",
										borderRadius: 1,
										px: 1,
										py: 0.5,
										bgcolor: alpha(severityColor(student.averagePercent), 0.1),
									}}
								>
									<Typography
										variant="body2"
										sx={{
											color: severityColor(student.averagePercent),
											whiteSpace: "nowrap",
										}}
									>
										{formatMarks(student.marks)} /{" "}
										{formatMarks(student.maxMarks)}
									</Typography>
								</Box>
							</TableCell>
							<TableCell align="right" sx={{ minWidth: 180 }}>
								<CompletionProgress
									assessedCount={student.completedRubrics}
									totalCount={student.totalRubrics}
									completionPercent={
										student.totalRubrics > 0
											? (student.completedRubrics / student.totalRubrics) * 100
											: 0
									}
									alignItems="flex-end"
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
