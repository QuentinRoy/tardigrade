import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { loadSubmissionAssessments } from "#assessment-capture/assessments.ts";
import SubmissionOverviewAssessmentClient from "#assessment-capture/SubmissionOverviewAssessmentClient.tsx";
import { saveAssessment } from "#assessment-capture/saveAssessment.ts";
import { loadAssessmentCompletionBySubmission } from "#assessment-completion/loadAssessmentCompletion.ts";
import MuiNextLink from "#design-system/MuiNextLink.tsx";
import { projectAssessmentsPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadQuestionGrid } from "#questions/questions.ts";
import { attachAssessment } from "#rubrics/rubric.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import type { Submission } from "#submissions/types.ts";

type PageParams = {
	projectId: string;
	projectSlug: string;
	submissionId: string;
};

type SubmissionPageProps = { params: Promise<PageParams> };

export default function ProjectSubmissionPage({ params }: SubmissionPageProps) {
	return <ProjectSubmissionPageContent params={params} />;
}

async function ProjectSubmissionPageContent({ params }: SubmissionPageProps) {
	const { submissionId, projectId } = await params;

	const [project, submissions] = await Promise.all([
		loadProjectByPublicId(projectId, { required: true }),
		loadSubmissions({ projectId }),
	]);

	// Ensure the submission belongs to the project and can be assessed.
	const currentSubmission = submissions.find((s) => s.id === submissionId);
	if (currentSubmission == null) {
		notFound();
	}

	return (
		<Container maxWidth="md" sx={{ py: 5 }}>
			<Box component="header" sx={{ pb: 2 }}>
				<Breadcrumbs aria-label="breadcrumb">
					<MuiNextLink
						color="inherit"
						href={projectAssessmentsPath({
							projectId: project.id,
							projectSlug: project.slug,
						})}
					>
						Assessments
					</MuiNextLink>
					<Typography color="textPrimary">
						{getSubmissionLabel(currentSubmission)}
					</Typography>
				</Breadcrumbs>
				<Typography component="h1" variant="h4" gutterBottom sx={{ mt: 1 }}>
					{getSubmissionLabel(currentSubmission)}
				</Typography>
			</Box>

			<Suspense fallback={<SubmissionGradingSectionSkeleton />}>
				<SubmissionGradingSection
					projectId={project.id}
					projectSlug={project.slug}
					submissionId={submissionId}
					submissions={submissions}
				/>
			</Suspense>
		</Container>
	);
}

// No "use cache" here: a Suspense boundary inside a `"use cache"` scope fully
// resolves before being cached, so it can't stream — see `loadQuestionGrid`'s
// own cache and `progressPromise` below for why caching still works.
async function SubmissionGradingSection({
	projectId,
	projectSlug,
	submissionId,
	submissions,
}: {
	projectId: string;
	projectSlug: string;
	submissionId: string;
	submissions: Submission[];
}) {
	// Doesn't depend on `questionGrid`/`assessmentsByQuestionId`, so it's started
	// alongside the Promise.all below rather than after it. Not awaited here:
	// only the on-demand submission lookup dialog needs it, so a save-then-
	// navigate never blocks on recomputing project-wide completion (Finding 19).
	const progressPromise = loadAssessmentCompletionBySubmission({ projectId });
	progressPromise.catch(() => {});

	const [questionGrid, assessmentsByQuestionId] = await Promise.all([
		loadQuestionGrid({ projectId }),
		loadSubmissionAssessments({ submissionId, projectId }),
	]);

	const gradedQuestions = Object.entries(questionGrid).map(
		([questionId, question]) => ({
			questionId,
			questionLabel: question.label ?? questionId,
			rubrics: question.rubrics.map((rubric) =>
				attachAssessment(rubric, assessmentsByQuestionId[questionId]),
			),
		}),
	);

	return (
		<SubmissionOverviewAssessmentClient
			projectId={projectId}
			projectSlug={projectSlug}
			currentSubmissionId={submissionId}
			submissions={submissions}
			progressPromise={progressPromise}
			questions={gradedQuestions}
			saveAssessment={saveAssessment}
		/>
	);
}

// Mirrors `SubmissionOverviewAssessmentClient`'s layout (prev/next/lookup
// buttons, then rubric rows) so the breadcrumb/title above stay in place and
// the page doesn't jump once assessment values and progress load.
function SubmissionGradingSectionSkeleton(): ReactElement {
	return (
		<>
			<Box sx={{ mb: 4, display: "flex", gap: 1 }}>
				<Skeleton variant="rounded" width={140} height={36} />
				<Skeleton variant="rounded" width={120} height={36} />
				<Skeleton variant="rounded" width={80} height={36} />
			</Box>
			{[0, 1, 2].map((index) => (
				<Skeleton key={index} variant="rounded" height={80} sx={{ mb: 2 }} />
			))}
		</>
	);
}
