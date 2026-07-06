import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactElement } from "react";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import Panel from "#design-system/Panel.tsx";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadRubricOverviewData } from "#rubric-analytics/loadRubricOverview.ts";
import RubricAnalyticsTable from "#rubric-analytics/RubricAnalyticsTable.tsx";
import SubmissionMatrix from "#rubric-analytics/SubmissionMatrix.tsx";

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
		<Panel miw={{ base: "100%", sm: 210 }} flex="1 1 210px">
			<Text size="xs" c="dimmed">
				{title}
			</Text>
			<Title order={3}>{value}</Title>
		</Panel>
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

	const data = await loadRubricOverviewData({ projectId: project.id });

	return (
		<AppPage size="lg">
			<PageHeader title="Rubric overview" />

			<Stack gap="lg">
				<Group gap="sm" wrap="wrap">
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
				</Group>

				<Stack gap="xs">
					<Title order={2}>Rubric analytics</Title>
					<RubricAnalyticsTable rubrics={data.rubrics} />
				</Stack>

				<Stack gap="xs">
					<Title order={2}>Submission matrix</Title>
					<SubmissionMatrix
						rubrics={data.rubrics}
						submissionRows={data.submissionRows}
					/>
				</Stack>
			</Stack>
		</AppPage>
	);
}
