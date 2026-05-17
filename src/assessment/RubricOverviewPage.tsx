import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { RubricOverviewData } from "@/db/rubricOverviewBuilder";
import RubricDetailsTooltip from "./RubricDetailsTooltip";

type RubricOverviewPageProps = {
  data: RubricOverviewData;
};

function formatMarks(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(1).replace(/\.0$/, "");
}

function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

function severityColor(percent: number | null): string {
  if (percent == null || Number.isNaN(percent)) {
    return "hsl(220 8% 60%)";
  }

  const clamped = Math.max(0, Math.min(percent, 100));
  const hue = Math.max(0, Math.min(120, clamped * 1.2));
  return `hsl(${hue} 70% 42%)`;
}

function summaryMetric(title: string, value: string): ReactElement {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        minWidth: { xs: "100%", sm: 210 },
        flex: "1 1 210px",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5">{value}</Typography>
    </Paper>
  );
}

export default function RubricOverviewPage({
  data,
}: RubricOverviewPageProps): ReactElement {
  return (
    <Stack sx={{ gap: 3 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {summaryMetric(
          "Rubric assessments",
          `${data.summary.assessedRubrics} / ${data.summary.totalRubrics}`,
        )}
        {summaryMetric(
          "Completion",
          formatPercent(data.summary.completionPercent),
        )}
        {summaryMetric(
          "Class average",
          formatPercent(data.summary.classAveragePercent),
        )}
      </Box>

      <Box>
        <Typography component="h2" variant="h5" sx={{ mb: 1 }}>
          Rubric analytics
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Rubric analytics">
            <TableHead>
              <TableRow>
                <TableCell>Rubric id</TableCell>
                <TableCell>Question</TableCell>
                <TableCell align="right">Average</TableCell>
                <TableCell align="right">Completion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rubrics.map((rubric) => {
                const color = severityColor(rubric.averagePercent);

                return (
                  <TableRow key={rubric.rubricId}>
                    <TableCell>
                      <RubricDetailsTooltip
                        rubricId={rubric.rubricId}
                        details={rubric.details}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {rubric.questionLabel}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: "inline-flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 0.25,
                          borderRadius: 1,
                          px: 1,
                          py: 0.5,
                          bgcolor: alpha(color, 0.1),
                        }}
                      >
                        <Typography variant="caption" sx={{ color }}>
                          {formatPercent(rubric.averagePercent)}
                        </Typography>
                        <Typography variant="body2" sx={{ color }}>
                          {formatMarks(rubric.averageMarks)} /{" "}
                          {formatMarks(rubric.maxMarks)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 180 }}>
                      <Stack sx={{ gap: 0.75, alignItems: "flex-end" }}>
                        <Chip
                          size="small"
                          label={`${rubric.assessedCount} / ${rubric.totalCount}`}
                          variant="outlined"
                        />
                        <Box sx={{ width: 120 }}>
                          <LinearProgress
                            variant="determinate"
                            value={rubric.completionPercent}
                            color="secondary"
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box>
        <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
          Student matrix
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Student matrix">
            <TableHead>
              <TableRow>
                <TableCell>Submission</TableCell>
                {data.rubrics.map((rubric) => (
                  <TableCell key={rubric.rubricId} align="center">
                    {rubric.rubricId}
                  </TableCell>
                ))}
                <TableCell align="right">Average</TableCell>
                <TableCell align="right">Completion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.students.map((student) => (
                <TableRow key={student.submissionId}>
                  <TableCell>{student.submissionLabel}</TableCell>
                  {student.rubrics.map((rubricCell) => {
                    const color = rubricCell.assessed
                      ? severityColor(
                          rubricCell.maxMarks > 0
                            ? ((rubricCell.marks ?? 0) / rubricCell.maxMarks) *
                                100
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
                          <Typography variant="caption">
                            {rubricCell.assessed
                              ? `${formatMarks(rubricCell.marks)} / ${formatMarks(rubricCell.maxMarks)}`
                              : "-"}
                          </Typography>
                        </Box>
                      </TableCell>
                    );
                  })}
                  <TableCell align="right">
                    {formatPercent(student.averagePercent)} (
                    {formatMarks(student.marks)} /{" "}
                    {formatMarks(student.maxMarks)})
                  </TableCell>
                  <TableCell align="right">
                    {student.completedRubrics} / {student.totalRubrics}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Stack>
  );
}
