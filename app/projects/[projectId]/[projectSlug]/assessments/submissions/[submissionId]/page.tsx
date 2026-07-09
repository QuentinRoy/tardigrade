import { Group, Skeleton, Stack } from "@mantine/core";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { loadSubmissionAssessments } from "#assessment-capture/assessments.ts";
import SubmissionOverviewAssessmentClient from "#assessment-capture/SubmissionOverviewAssessmentClient.tsx";
import { saveAssessment } from "#assessment-capture/saveAssessment.ts";
import { loadAssessmentCompletionBySubmission } from "#assessment-completion/loadAssessmentCompletion.ts";
import { attachAssessment } from "#criteria/criterion.ts";
import AppLink from "#design-system/AppLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import { projectAssessmentsPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadRubricsById } from "#rubrics/rubrics.ts";
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
		<AppPage>
			<PageHeader
				breadcrumbs={[
					<AppLink
						key="assessments"
						href={projectAssessmentsPath({
							projectId: project.id,
							projectSlug: project.slug,
						})}
					>
						Assessments
					</AppLink>,
					getSubmissionLabel(currentSubmission),
				]}
				title={getSubmissionLabel(currentSubmission)}
			/>

			<Suspense fallback={<SubmissionGradingSectionSkeleton />}>
				<SubmissionGradingSection
					projectId={project.id}
					projectSlug={project.slug}
					submissionId={submissionId}
					submissions={submissions}
				/>
			</Suspense>
		</AppPage>
	);
}

// No "use cache" here: a Suspense boundary inside a `"use cache"` scope fully
// resolves before being cached, so it can't stream — see `loadRubricsById`'s
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
	// Doesn't depend on `rubricsById`/`assessmentsByRubricId`, so it's started
	// alongside the Promise.all below rather than after it. Not awaited here:
	// only the on-demand submission lookup dialog needs it, so a save-then-
	// navigate never blocks on recomputing project-wide completion (Finding 19).
	const progressPromise = loadAssessmentCompletionBySubmission({ projectId });
	progressPromise.catch(() => {});

	const [rubricsById, assessmentsByRubricId] = await Promise.all([
		loadRubricsById({ projectId }),
		loadSubmissionAssessments({ submissionId, projectId }),
	]);

	const gradedRubrics = Object.entries(rubricsById).map(
		([rubricId, rubric]) => ({
			rubricId,
			rubricLabel: rubric.label ?? rubricId,
			criteria: rubric.criteria.map((criterion) =>
				attachAssessment(criterion, assessmentsByRubricId[rubricId]),
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
			rubrics={gradedRubrics}
			saveAssessment={saveAssessment}
		/>
	);
}

// Mirrors `SubmissionOverviewAssessmentClient`'s layout (prev/next/lookup
// buttons, then criterion rows) so the breadcrumb/title above stay in place and
// the page doesn't jump once assessment values and progress load.
function SubmissionGradingSectionSkeleton(): ReactElement {
	return (
		<Stack gap="md">
			<Group gap="xs">
				<Skeleton radius="sm" width={140} height={36} />
				<Skeleton radius="sm" width={120} height={36} />
				<Skeleton radius="sm" width={80} height={36} />
			</Group>
			<Stack gap="sm">
				{[0, 1, 2].map((index) => (
					<Skeleton key={index} radius="sm" height={80} />
				))}
			</Stack>
		</Stack>
	);
}
