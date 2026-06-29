import {
	Box,
	Button,
	Container,
	LinearProgress,
	List,
	ListItemButton,
	ListItemText,
	Skeleton,
	Stack,
	Typography,
} from "@mui/material";
import { Suspense } from "react";
import { loadAssessmentCompletionBySubmission } from "#assessment-completion/loadAssessmentCompletion.ts";
import {
	projectAssessmentSubmissionPath,
	projectAssessmentSubmissionQuestionPath,
	projectOverviewPath,
	projectQuestionsPath,
} from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import QuestionList from "#question-management/QuestionList.tsx";
import { loadQuestionGrid } from "#questions/questions.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import type { Submission } from "#submissions/types.ts";

type ProjectAssessmentsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectAssessmentPage({
	params,
}: ProjectAssessmentsPageProps) {
	const { projectId } = await params;
	return <ProjectAssessmentPageContent projectId={projectId} />;
}

// No page-level `"use cache"` wrapper: `loadProjectByPublicId`, `loadQuestionGrid`
// and `loadSubmissions` each cache themselves, and the submission progress below
// is deliberately left uncached at this scope so it can stream in under Suspense
// instead of blocking this render on a project-wide completion recompute (Finding 19).
async function ProjectAssessmentPageContent({
	projectId,
}: {
	projectId: string;
}) {
	const project = await loadProjectByPublicId(projectId, { required: true });

	const [grid, submissions] = await Promise.all([
		loadQuestionGrid({ projectId: project.id }),
		loadSubmissions({ projectId: project.id }),
	]);

	const hasQuestions = Object.keys(grid).length > 0;
	const firstSubmissionId = submissions[0]?.id;
	const questions = firstSubmissionId
		? Object.entries(grid).map(([id, { label }]) => ({
				id,
				label: label == null ? id : label,
				href: projectAssessmentSubmissionQuestionPath({
					projectId: project.id,
					projectSlug: project.slug,
					submissionId: firstSubmissionId,
					questionId: id,
				}),
			}))
		: [];

	return (
		<Container component="main" maxWidth="md" sx={{ py: 5 }}>
			<Typography component="h1" variant="h3" sx={{ mb: 3 }}>
				Assessments
			</Typography>
			<Box sx={{ mb: 3 }}>
				<Button
					href={projectOverviewPath({
						projectId: project.id,
						projectSlug: project.slug,
					})}
					variant="outlined"
				>
					Open rubric overview
				</Button>
			</Box>
			{!hasQuestions ? (
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
			) : (
				<>
					<Typography component="h2" variant="h5" sx={{ mb: 2 }}>
						Assess by submission
					</Typography>
					<Suspense
						fallback={
							<SubmissionListSkeleton
								projectId={project.id}
								projectSlug={project.slug}
								submissions={submissions}
							/>
						}
					>
						<SubmissionProgressList
							projectId={project.id}
							projectSlug={project.slug}
							submissions={submissions}
						/>
					</Suspense>
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
				</>
			)}
		</Container>
	);
}

async function SubmissionProgressList({
	projectId,
	projectSlug,
	submissions,
}: {
	projectId: string;
	projectSlug: string;
	submissions: Submission[];
}) {
	const progressBySubmissionId = await loadAssessmentCompletionBySubmission({
		projectId,
	});

	return (
		<List component="nav" aria-label="Submission list" sx={{ mb: 3 }}>
			{submissions.map((submission) => {
				const progress = progressBySubmissionId[submission.id];
				const completed = progress?.completed ?? 0;
				const total = progress?.total ?? 0;
				const percent = total > 0 ? (completed / total) * 100 : 0;
				return (
					<ListItemButton
						key={submission.id}
						href={projectAssessmentSubmissionPath({
							projectId,
							projectSlug,
							submissionId: submission.id,
						})}
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
	);
}

// Mirrors `SubmissionProgressList`'s layout so the submission links and labels
// are clickable immediately, with placeholders standing in for progress while
// it streams in (Finding 19: a save must not block the next navigation on a
// project-wide completion recompute).
function SubmissionListSkeleton({
	projectId,
	projectSlug,
	submissions,
}: {
	projectId: string;
	projectSlug: string;
	submissions: Submission[];
}) {
	return (
		<List component="nav" aria-label="Submission list" sx={{ mb: 3 }}>
			{submissions.map((submission) => (
				<ListItemButton
					key={submission.id}
					href={projectAssessmentSubmissionPath({
						projectId,
						projectSlug,
						submissionId: submission.id,
					})}
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
						<Skeleton variant="text" width={36} height={20} />
						<Skeleton variant="rounded" width={44} height={4} />
					</Box>
				</ListItemButton>
			))}
		</List>
	);
}
