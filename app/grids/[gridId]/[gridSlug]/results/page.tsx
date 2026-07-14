import { Stack, Title } from "@mantine/core";
import type { ReactElement } from "react";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import { loadGridByPublicId } from "#grids/grids.ts";
import CriterionAnalyticsTable from "#results/CriterionAnalyticsTable.tsx";
import GradeMatrix from "#results/GradeMatrix.tsx";
import { loadResultsData } from "#results/loadResults.ts";

type GridResultsPageProps = {
	params: Promise<{ gridId: string; gridSlug: string }>;
};

export default function GridResultsPage({
	params,
}: GridResultsPageProps): ReactElement {
	return <GridResultsPageContent params={params} />;
}

async function GridResultsPageContent({
	params,
}: GridResultsPageProps): Promise<ReactElement> {
	const { gridId } = await params;
	const grid = await loadGridByPublicId(gridId, { required: true });

	const data = await loadResultsData({ gridId: grid.id });

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
