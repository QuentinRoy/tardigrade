import { Button, Container, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import GlobalAssessmentSummary from "@/assessment/GlobalAssessmentSummary";
import { loadGlobalAssessmentProgress } from "@/db/assessmentsProgress";
import { loadProjectByPublicId } from "@/db/projects";
import {
  projectAssessmentsPath,
  projectDashboardPath,
} from "@/projects/projectPaths";

type ProjectDashboardPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectDashboardPage({
	params,
}: ProjectDashboardPageProps) {
	const { projectId, projectSlug } = await params;

  const project = await loadProjectByPublicId(projectId, { required: true });

	if (project.slug !== projectSlug) {
		redirect(projectDashboardPath(project.id, project.slug));
	}

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
