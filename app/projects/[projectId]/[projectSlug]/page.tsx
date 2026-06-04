import { Button, Container, Stack, Typography } from "@mui/material";
import { loadGlobalAssessmentProgress } from "#assessments/assessmentsProgress.ts";
import GlobalAssessmentSummary from "#assessments/GlobalAssessmentSummary.tsx";
import { projectAssessmentsPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";

type ProjectDashboardPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectDashboardPage({
	params,
}: ProjectDashboardPageProps) {
	const { projectId } = await params;

	const project = await loadProjectByPublicId(projectId, { required: true });

	const progress = await loadGlobalAssessmentProgress(project.id);

	return (
		<Container component="main" maxWidth="md" sx={{ py: 5 }}>
			<Stack sx={{ gap: 3 }}>
				<Typography component="h1" variant="h2">
					{project.name} Dashboard
				</Typography>
				<GlobalAssessmentSummary progress={progress} />
				<div>
					<Button
						href={projectAssessmentsPath(project.id, project.slug)}
						variant="contained"
					>
						Open assessments
					</Button>
				</div>
			</Stack>
		</Container>
	);
}
