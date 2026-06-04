import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import RubricAnalyticsTable from "#assessments/RubricAnalyticsTable.tsx";
import { loadRubricOverviewData } from "#assessments/rubricOverview.ts";
import StudentMatrix from "#assessments/StudentMatrix.tsx";
import { loadProjectByPublicId } from "#projects/projects.ts";

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

function summaryMetric(title: string, value: string): ReactElement {
	return (
		<Paper
			variant="outlined"
			sx={{ p: 2, minWidth: { xs: "100%", sm: 210 }, flex: "1 1 210px" }}
		>
			<Typography variant="caption" color="text.secondary">
				{title}
			</Typography>
			<Typography variant="h5">{value}</Typography>
		</Paper>
	);
}

type ProjectAssessmentsOverviewPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default function ProjectAssessmentsOverviewPage({
	params,
}: ProjectAssessmentsOverviewPageProps): ReactElement {
	return <ProjectAssessmentsOverviewPageContent params={params} />;
}

async function ProjectAssessmentsOverviewPageContent({
	params,
}: ProjectAssessmentsOverviewPageProps): Promise<ReactElement> {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	const data = await loadRubricOverviewData(project.id);

	return (
		<Container component="main" maxWidth="lg" sx={{ py: 5 }}>
			<Box component="header" sx={{ mb: 3 }}>
				<Typography component="h1" variant="h4">
					Rubric overview
				</Typography>
			</Box>

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
						`${formatMarks(data.summary.classAverageMarks)} / ${formatMarks(data.summary.classAverageMaxMarks)}`,
					)}
				</Box>

				<Box>
					<Typography component="h2" variant="h5" sx={{ mb: 1 }}>
						Rubric analytics
					</Typography>
					<RubricAnalyticsTable rubrics={data.rubrics} />
				</Box>

				<Box>
					<Typography component="h2" variant="h6" sx={{ mb: 1 }}>
						Student matrix
					</Typography>
					<StudentMatrix rubrics={data.rubrics} students={data.students} />
				</Box>
			</Stack>
		</Container>
	);
}
