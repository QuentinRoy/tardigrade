import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { loadQuestionAssessment } from "#assessments/assessments.ts";
import {
	buildAssessedRubricCountsBySubmission,
	loadAssessedRubricCounts,
} from "#assessments/loadAssessmentCompletion.ts";
import SubmissionAssessmentClient from "#assessments/SubmissionAssessmentClient.tsx";
import {
	cacheTags,
	projectCacheTag,
	questionListCacheTag,
} from "#db/cacheTags.ts";
import { projectAssessmentsPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadQuestion } from "#questions/questions.ts";
import { attachAssessment } from "#rubrics/rubric.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import MuiNextLink from "#ui/MuiNextLink.tsx";

type PageParams = {
	projectId: string;
	projectSlug: string;
	submissionId: string;
	questionId: string;
};

type QuestionSubmissionPageProps = { params: Promise<PageParams> };

export default function ProjectQuestionSubmissionPage({
	params,
}: QuestionSubmissionPageProps) {
	return <ProjectQuestionSubmissionPageContent params={params} />;
}

async function ProjectQuestionSubmissionPageContent({
	params,
}: QuestionSubmissionPageProps) {
	const { projectId, submissionId, questionId } = await params;

	return (
		<Container maxWidth="md" sx={{ py: 5 }}>
			<QuestionHeaderSection projectId={projectId} questionId={questionId} />
			<Suspense fallback={<SubmissionRubricSectionSkeleton />}>
				<SubmissionRubricSection
					questionId={questionId}
					submissionId={submissionId}
					projectId={projectId}
				/>
			</Suspense>
		</Container>
	);
}

async function QuestionHeaderSection({
	projectId,
	questionId,
}: {
	projectId: string;
	questionId: string;
}) {
	"use cache";
	cacheTags(projectCacheTag(projectId), questionListCacheTag());

	const project = await loadProjectByPublicId(projectId, { required: true });

	const question = await loadQuestion({ questionId, projectId: project.id });

	if (question == null) {
		notFound();
	}

	return (
		<>
			<Box component="header" sx={{ pb: 2 }}>
				<Breadcrumbs aria-label="breadcrumb">
					<MuiNextLink
						color="inherit"
						href={projectAssessmentsPath(project.id, project.slug)}
					>
						Assessments
					</MuiNextLink>
					<Typography color="textPrimary">
						{question.label ?? questionId}
					</Typography>
				</Breadcrumbs>
			</Box>

			<Box component="section">
				<Typography component="h1" variant="h4" gutterBottom>
					{question.label ?? questionId}
				</Typography>
			</Box>
		</>
	);
}

// No "use cache" here: `loadQuestion`, `loadSubmissions` and `loadQuestionAssessment`
// each cache themselves. The rubric progress used by the lookup dialog is
// deliberately left uncached and unawaited at this scope so a save-then-navigate
// never blocks on recomputing it — it streams in via Suspense once the dialog
// opens (Finding 19).
async function SubmissionRubricSection({
	questionId,
	submissionId,
	projectId,
}: {
	questionId: string;
	submissionId: string;
	projectId: string;
}) {
	const project = await loadProjectByPublicId(projectId, { required: true });

	const [question, submissions, assessments] = await Promise.all([
		loadQuestion({ questionId, projectId: project.id }),
		loadSubmissions({ projectId: project.id }),
		loadQuestionAssessment({ submissionId, questionId, projectId: project.id }),
	]);
	const hasSubmission = submissions.some(
		(submission) => submission.id === submissionId,
	);

	if (question == null || !hasSubmission) {
		notFound();
	}

	// Reuses the submissions already loaded above instead of querying them again
	// inside the progress primitive (Finding 7).
	const progressPromise = loadAssessedRubricCounts({
		questionId,
		projectId: project.id,
	}).then((rubricCounts) =>
		buildAssessedRubricCountsBySubmission(
			submissions.map((submission) => submission.id),
			rubricCounts,
		),
	);

	const rubricsWithAssessments = question.rubrics.map((rubric) =>
		attachAssessment(rubric, assessments),
	);

	return (
		<SubmissionAssessmentClient
			key={`${questionId}-${submissionId}`}
			projectId={project.id}
			projectSlug={project.slug}
			questionId={questionId}
			questionLabel={question.label}
			rubrics={rubricsWithAssessments}
			submissions={submissions}
			progressPromise={progressPromise}
			currentSubmissionId={submissionId}
		/>
	);
}

// Mirrors `SubmissionAssessmentClient`'s layout (current-submission card,
// prev/next/lookup buttons, rubric rows) so the question header above stays in
// place and the page doesn't jump once assessment values and progress load.
function SubmissionRubricSectionSkeleton(): ReactElement {
	return (
		<>
			<Box
				sx={{
					mb: 2,
					p: 2,
					border: "1px solid",
					borderColor: "divider",
					borderRadius: 1,
				}}
			>
				<Skeleton variant="text" width={140} height={20} />
				<Skeleton variant="text" width={200} height={32} />
				<Skeleton variant="text" width={120} height={20} />
			</Box>
			<Box sx={{ mb: 4, display: "flex", gap: 1 }}>
				<Skeleton variant="rounded" width={140} height={36} />
				<Skeleton variant="rounded" width={120} height={36} />
				<Skeleton variant="rounded" width={80} height={36} />
			</Box>
			{[0, 1, 2].map((index) => (
				<Skeleton key={index} variant="rounded" height={56} sx={{ mb: 1 }} />
			))}
		</>
	);
}
