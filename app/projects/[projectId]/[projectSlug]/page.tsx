import { Stack, Text, Title } from "@mantine/core";
import AppButtonLink from "#design-system/AppButtonLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import GlobalCompletionSummary from "#grade-completion/GlobalCompletionSummary.tsx";
import { loadGradeCompletionSummary } from "#grade-completion/loadGradeCompletion.ts";
import {
	projectGradesPath,
	projectImportStudentsPath,
	projectRubricsPath,
} from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";

type ProjectDashboardPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectDashboardPage({
	params,
}: ProjectDashboardPageProps) {
	const { projectId } = await params;

	const project = await loadProjectByPublicId(projectId, { required: true });

	const completion = await loadGradeCompletionSummary({
		projectId: project.id,
	});

	return (
		<AppPage>
			<Stack gap="lg">
				<Title order={1}>{project.name} Dashboard</Title>
				{completion.rubrics.total === 0 ? (
					<Stack gap="sm" align="flex-start">
						<Text c="dimmed">
							No rubrics yet — add rubrics to start grading.
						</Text>
						<AppButtonLink
							href={projectRubricsPath({
								projectId: project.id,
								projectSlug: project.slug,
							})}
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
							href={projectImportStudentsPath({
								projectId: project.id,
								projectSlug: project.slug,
							})}
						>
							Import students
						</AppButtonLink>
					</Stack>
				) : (
					<GlobalCompletionSummary completion={completion} />
				)}
				<AppButtonLink
					href={projectGradesPath({
						projectId: project.id,
						projectSlug: project.slug,
					})}
				>
					Open grades
				</AppButtonLink>
			</Stack>
		</AppPage>
	);
}
