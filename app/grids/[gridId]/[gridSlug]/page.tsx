import { Stack, Text, Title } from "@mantine/core";
import AppButtonLink from "#design-system/AppButtonLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import GlobalCompletionSummary from "#grade-completion/GlobalCompletionSummary.tsx";
import { loadGradeCompletionSummary } from "#grade-completion/loadGradeCompletion.ts";
import {
	gridGradesPath,
	gridImportStudentsPath,
	gridRubricsPath,
} from "#grids/gridPaths.ts";
import { loadGridByPublicId } from "#grids/grids.ts";

type GridOverviewPageProps = {
	params: Promise<{ gridId: string; gridSlug: string }>;
};

export default async function GridOverviewPage({
	params,
}: GridOverviewPageProps) {
	const { gridId } = await params;

	const grid = await loadGridByPublicId(gridId, { required: true });

	const completion = await loadGradeCompletionSummary({ gridId: grid.id });

	return (
		<AppPage>
			<Stack gap="lg">
				<Title order={1}>{grid.name} Overview</Title>
				{completion.rubrics.total === 0 ? (
					<Stack gap="sm" align="flex-start">
						<Text c="dimmed">
							No rubrics yet — add rubrics to start grading.
						</Text>
						<AppButtonLink
							href={gridRubricsPath({ gridId: grid.id, gridSlug: grid.slug })}
						>
							Add rubrics
						</AppButtonLink>
					</Stack>
				) : completion.gradeTargets.total === 0 ? (
					<Stack gap="sm" align="flex-start">
						<Text c="dimmed">
							No students or groups yet — import a roster to start grading.
						</Text>
						<AppButtonLink
							href={gridImportStudentsPath({
								gridId: grid.id,
								gridSlug: grid.slug,
							})}
						>
							Import students
						</AppButtonLink>
					</Stack>
				) : (
					<GlobalCompletionSummary completion={completion} />
				)}
				<AppButtonLink
					href={gridGradesPath({ gridId: grid.id, gridSlug: grid.slug })}
				>
					Open grades
				</AppButtonLink>
			</Stack>
		</AppPage>
	);
}
