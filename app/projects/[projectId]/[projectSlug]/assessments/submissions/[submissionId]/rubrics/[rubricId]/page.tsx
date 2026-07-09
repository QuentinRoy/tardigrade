import { Card, Group, Skeleton, Stack } from "@mantine/core";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { loadRubricAssessment } from "#assessment-capture/assessments.ts";
import SubmissionAssessmentClient from "#assessment-capture/SubmissionAssessmentClient.tsx";
import { saveAssessment } from "#assessment-capture/saveAssessment.ts";
import {
	buildAssessedCriterionCountsBySubmission,
	loadAssessedCriterionCounts,
} from "#assessment-completion/loadAssessmentCompletion.ts";
import { attachAssessment } from "#criteria/criterion.ts";
import {
	cacheTags,
	projectCacheTag,
	rubricListCacheTag,
} from "#db/cacheTags.ts";
import AppLink from "#design-system/AppLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import { projectAssessmentsPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadRubric } from "#rubrics/rubrics.ts";
import { loadSubmissions } from "#submissions/submissions.ts";

type PageParams = {
	projectId: string;
	projectSlug: string;
	submissionId: string;
	rubricId: string;
};

type RubricSubmissionPageProps = { params: Promise<PageParams> };

export default function ProjectRubricSubmissionPage({
	params,
}: RubricSubmissionPageProps) {
	return <ProjectRubricSubmissionPageContent params={params} />;
}

async function ProjectRubricSubmissionPageContent({
	params,
}: RubricSubmissionPageProps) {
	const { projectId, submissionId, rubricId } = await params;

	return (
		<AppPage>
			<RubricHeaderSection projectId={projectId} rubricId={rubricId} />
			<Suspense fallback={<SubmissionCriterionSectionSkeleton />}>
				<SubmissionCriterionSection
					rubricId={rubricId}
					submissionId={submissionId}
					projectId={projectId}
				/>
			</Suspense>
		</AppPage>
	);
}

async function RubricHeaderSection({
	projectId,
	rubricId,
}: {
	projectId: string;
	rubricId: string;
}) {
	"use cache";
	cacheTags(projectCacheTag(projectId), rubricListCacheTag());

	const project = await loadProjectByPublicId(projectId, { required: true });

	const rubric = await loadRubric({ rubricId, projectId: project.id });

	if (rubric == null) {
		notFound();
	}

	return (
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
				rubric.label ?? rubricId,
			]}
			title={rubric.label ?? rubricId}
		/>
	);
}

// No "use cache" here: `loadRubric`, `loadSubmissions` and `loadRubricAssessment`
// each cache themselves. The criterion progress used by the lookup dialog is
// deliberately left uncached and unawaited at this scope so a save-then-navigate
// never blocks on recomputing it — it streams in via Suspense once the dialog
// opens (Finding 19).
async function SubmissionCriterionSection({
	rubricId,
	submissionId,
	projectId,
}: {
	rubricId: string;
	submissionId: string;
	projectId: string;
}) {
	const project = await loadProjectByPublicId(projectId, { required: true });

	// Doesn't depend on `submissions`, so it's started alongside the Promise.all
	// below rather than after it, keeping the progress work parallel and
	// shortening the wait if the lookup dialog is opened quickly.
	const criterionCountsPromise = loadAssessedCriterionCounts({
		rubricId,
		projectId: project.id,
	});

	const [rubric, submissions, assessments] = await Promise.all([
		loadRubric({ rubricId, projectId: project.id }),
		loadSubmissions({ projectId: project.id }),
		loadRubricAssessment({ submissionId, rubricId, projectId: project.id }),
	]);
	const hasSubmission = submissions.some(
		(submission) => submission.id === submissionId,
	);

	if (rubric == null || !hasSubmission) {
		notFound();
	}

	// Reuses the submissions already loaded above instead of querying them again
	// inside the progress primitive (Finding 7).
	const progressPromise = criterionCountsPromise.then((criterionCounts) =>
		buildAssessedCriterionCountsBySubmission(
			submissions.map((submission) => submission.id),
			criterionCounts,
		),
	);

	const criteriaWithAssessments = rubric.criteria.map((criterion) =>
		attachAssessment(criterion, assessments),
	);

	return (
		<SubmissionAssessmentClient
			key={`${rubricId}-${submissionId}`}
			projectId={project.id}
			projectSlug={project.slug}
			rubricId={rubricId}
			rubricLabel={rubric.label}
			criteria={criteriaWithAssessments}
			submissions={submissions}
			progressPromise={progressPromise}
			currentSubmissionId={submissionId}
			saveAssessment={saveAssessment}
		/>
	);
}

// Mirrors `SubmissionAssessmentClient`'s layout (current-submission card,
// prev/next/lookup buttons, criterion rows) so the rubric header above stays in
// place and the page doesn't jump once assessment values and progress load.
function SubmissionCriterionSectionSkeleton(): ReactElement {
	return (
		<Stack gap="md">
			<Card withBorder padding="md">
				<Skeleton height={20} width={140} mb="xs" />
				<Skeleton height={32} width={200} mb="xs" />
				<Skeleton height={20} width={120} />
			</Card>
			<Group gap="xs">
				<Skeleton radius="sm" width={140} height={36} />
				<Skeleton radius="sm" width={120} height={36} />
				<Skeleton radius="sm" width={80} height={36} />
			</Group>
			<Stack gap="xs">
				{[0, 1, 2].map((index) => (
					<Skeleton key={index} radius="sm" height={56} />
				))}
			</Stack>
		</Stack>
	);
}
