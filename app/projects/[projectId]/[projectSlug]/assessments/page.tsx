import { Progress, Skeleton, Stack, Text, Title } from "@mantine/core";
import { Suspense } from "react";
import { loadAssessmentCompletionBySubmission } from "#assessment-completion/loadAssessmentCompletion.ts";
import AppButtonLink from "#design-system/AppButtonLink.tsx";
import AppNavLink from "#design-system/AppNavLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
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
		<AppPage>
			<Stack gap="lg">
				<Title order={1}>Assessments</Title>
				<AppButtonLink
					href={projectOverviewPath({
						projectId: project.id,
						projectSlug: project.slug,
					})}
					variant="outline"
				>
					Open rubric overview
				</AppButtonLink>
				{!hasQuestions ? (
					<Stack gap="sm" align="flex-start">
						<Text c="dimmed">
							No questions yet — add questions to start assessing.
						</Text>
						<AppButtonLink
							href={projectQuestionsPath({
								projectId: project.id,
								projectSlug: project.slug,
							})}
						>
							Add questions
						</AppButtonLink>
					</Stack>
				) : (
					<>
						<Stack gap="sm">
							<Title order={2}>Assess by submission</Title>
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
						</Stack>
						<Stack gap="sm">
							<Title order={2}>Assess by question</Title>
							{firstSubmissionId ? (
								<QuestionList questions={questions} />
							) : (
								<Text c="dimmed">
									Add a submission first to start assessments by question.
								</Text>
							)}
						</Stack>
					</>
				)}
			</Stack>
		</AppPage>
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
		<Stack component="nav" aria-label="Submission list" gap="xs">
			{submissions.map((submission) => {
				const progress = progressBySubmissionId[submission.id];
				const completed = progress?.completed ?? 0;
				const total = progress?.total ?? 0;
				const percent = total > 0 ? (completed / total) * 100 : 0;
				const isComplete = completed === total && total > 0;
				return (
					<AppNavLink
						key={submission.id}
						href={projectAssessmentSubmissionPath({
							projectId,
							projectSlug,
							submissionId: submission.id,
						})}
						label={getSubmissionLabel(submission)}
						rightSection={
							<Stack gap={4} align="flex-end" miw={60}>
								<Text size="xs" fw={500} c={isComplete ? "green" : "dimmed"}>
									{completed} / {total}
								</Text>
								<Progress
									value={percent}
									size="xs"
									w={44}
									color={isComplete ? "green" : "gray"}
								/>
							</Stack>
						}
					/>
				);
			})}
		</Stack>
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
		<Stack component="nav" aria-label="Submission list" gap="xs">
			{submissions.map((submission) => (
				<AppNavLink
					key={submission.id}
					href={projectAssessmentSubmissionPath({
						projectId,
						projectSlug,
						submissionId: submission.id,
					})}
					label={getSubmissionLabel(submission)}
					rightSection={
						<Stack gap={4} align="flex-end" miw={60}>
							<Skeleton width={36} height={20} />
							<Skeleton width={44} height={4} />
						</Stack>
					}
				/>
			))}
		</Stack>
	);
}
