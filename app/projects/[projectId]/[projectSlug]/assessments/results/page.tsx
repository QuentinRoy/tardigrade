import { Stack, Title } from "@mantine/core";
import type { ReactElement } from "react";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import { loadProjectByPublicId } from "#projects/projects.ts";
import CriterionAnalyticsTable from "#results/CriterionAnalyticsTable.tsx";
import GradeMatrix from "#results/GradeMatrix.tsx";
import { loadResultsData } from "#results/loadResults.ts";

type ProjectResultsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default function ProjectResultsPage({
	params,
}: ProjectResultsPageProps): ReactElement {
	return <ProjectResultsPageContent params={params} />;
}

async function ProjectResultsPageContent({
	params,
}: ProjectResultsPageProps): Promise<ReactElement> {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	const data = await loadResultsData({ projectId: project.id });

	return (
		<AppPage size="lg">
			<PageHeader title="Results" />

			<Stack gap="lg">
				<Stack gap="xs">
					<Title order={2}>Analytics</Title>
					<CriterionAnalyticsTable criteria={data.criteria} />
				</Stack>

				<Stack gap="xs">
					<Title order={2}>Grades</Title>
					<GradeMatrix
						criteria={data.criteria}
						gradeTargetRows={data.gradeTargetRows}
					/>
				</Stack>
			</Stack>
		</AppPage>
	);
}
