import {
	Box,
	Button,
	Container,
	LinearProgress,
	List,
	ListItemButton,
	ListItemText,
	Typography,
} from "@mui/material";
import { cacheTag } from "next/cache";
import { loadSubmissionOverviewProgress } from "#assessments/submissionProgress.ts";
import {
	projectAssessmentSubmissionPath,
	projectAssessmentSubmissionQuestionPath,
	projectOverviewPath,
} from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import QuestionList from "#questions/QuestionList.tsx";
import { loadQuestions } from "#questions/questions.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import { loadSubmissions } from "#submissions/submissions.ts";

type ProjectAssessmentsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectAssessmentPage({
	params,
}: ProjectAssessmentsPageProps) {
	const { projectId } = await params;
	return <ProjectAssessmentPageContent projectId={projectId} />;
}

async function ProjectAssessmentPageContent({
	projectId,
}: {
	projectId: string;
}) {
	"use cache";
	cacheTag("assessments");

	const project = await loadProjectByPublicId(projectId, { required: true });

	const [grid, submissions, progressBySubmissionId] = await Promise.all([
		loadQuestions(project.id),
		loadSubmissions(project.id),
		loadSubmissionOverviewProgress(project.id),
	]);

	const firstSubmissionId = submissions[0]?.id;
	const questions = firstSubmissionId
		? Object.entries(grid).map(([id, { label }]) => ({
				id,
				label: label == null ? id : label,
				href: projectAssessmentSubmissionQuestionPath(
					project.id,
					project.slug,
					firstSubmissionId,
					id,
				),
			}))
		: [];

	return (
		<Container component="main" maxWidth="md" sx={{ py: 5 }}>
			<Typography component="h1" variant="h3" sx={{ mb: 3 }}>
				Assessments
			</Typography>
			<Box sx={{ mb: 3 }}>
				<Button
					href={projectOverviewPath(project.id, project.slug)}
					variant="outlined"
				>
					Open rubric overview
				</Button>
			</Box>
			<Typography component="h2" variant="h5" sx={{ mb: 2 }}>
				Assess by submission
			</Typography>
			<List component="nav" aria-label="Submission list" sx={{ mb: 3 }}>
				{submissions.map((submission) => {
					const progress = progressBySubmissionId[submission.id];
					const completed = progress?.completed ?? 0;
					const total = progress?.total ?? 0;
					const percent = total > 0 ? (completed / total) * 100 : 0;
					return (
						<ListItemButton
							key={submission.id}
							href={projectAssessmentSubmissionPath(
								project.id,
								project.slug,
								submission.id,
							)}
							sx={{ mb: 1, display: "flex", alignItems: "center" }}
						>
							<ListItemText primary={getSubmissionLabel(submission)} />
							<Box
								sx={{
									ml: 2,
									minWidth: 60,
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-end",
									gap: 0.5,
								}}
							>
								<Typography
									variant="caption"
									color={
										completed === total && total > 0
											? "success.main"
											: "text.secondary"
									}
									sx={{ fontWeight: 500 }}
								>
									{completed} / {total}
								</Typography>
								<Box sx={{ width: 44 }}>
									<LinearProgress
										variant="determinate"
										value={percent}
										sx={{ height: 4, borderRadius: 2 }}
										color={
											completed === total && total > 0 ? "success" : "secondary"
										}
									/>
								</Box>
							</Box>
						</ListItemButton>
					);
				})}
			</List>
			<Typography component="h2" variant="h5">
				Assess by question
			</Typography>
			{firstSubmissionId ? (
				<QuestionList questions={questions} />
			) : (
				<Typography color="text.secondary">
					Add a submission first to start assessments by question.
				</Typography>
			)}
		</Container>
	);
}
