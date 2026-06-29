import { Button, Container, Stack, Typography } from "@mui/material";
import GlobalAssessmentSummary from "#assessment-completion/GlobalAssessmentSummary.tsx";
import { loadAssessmentCompletionSummary } from "#assessment-completion/loadAssessmentCompletion.ts";
import {
	projectAssessmentsPath,
	projectImportStudentsPath,
	projectQuestionsPath,
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

	const progress = await loadAssessmentCompletionSummary({
		projectId: project.id,
	});

	return (
		<Container component="main" maxWidth="md" sx={{ py: 5 }}>
			<Stack sx={{ gap: 3 }}>
				<Typography component="h1" variant="h2">
					{project.name} Dashboard
				</Typography>
				{progress.questions.total === 0 ? (
					<Stack sx={{ gap: 2, alignItems: "flex-start" }}>
						<Typography color="text.secondary">
							No questions yet — add questions to start assessing.
						</Typography>
						<Button
							href={projectQuestionsPath({
								projectId: project.id,
								projectSlug: project.slug,
							})}
							variant="contained"
						>
							Add questions
						</Button>
					</Stack>
				) : progress.submissions.total === 0 ? (
					<Stack sx={{ gap: 2, alignItems: "flex-start" }}>
						<Typography color="text.secondary">
							No submissions yet — import submissions to start assessing.
						</Typography>
						<Button
							href={projectImportStudentsPath({
								projectId: project.id,
								projectSlug: project.slug,
							})}
							variant="contained"
						>
							Import submissions
						</Button>
					</Stack>
				) : (
					<GlobalAssessmentSummary progress={progress} />
				)}
				<div>
					<Button
						href={projectAssessmentsPath({
							projectId: project.id,
							projectSlug: project.slug,
						})}
						variant="contained"
					>
						Open assessments
					</Button>
				</div>
			</Stack>
		</Container>
	);
}
