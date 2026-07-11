import { Card, Group, Skeleton, Stack } from "@mantine/core";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { loadRubricAssessment } from "#assessment-capture/assessments.ts";
import GradeTargetAssessmentClient from "#assessment-capture/GradeTargetAssessmentClient.tsx";
import { saveAssessment } from "#assessment-capture/saveAssessment.ts";
import {
	buildAssessedCriterionCountsByTarget,
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
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import { projectGradesPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadRubric } from "#rubrics/rubrics.ts";

type PageParams = {
	projectId: string;
	projectSlug: string;
	targetId: string;
	targetSlug: string;
	rubricId: string;
};

type GradeTargetRubricPageProps = { params: Promise<PageParams> };

export default function GradeTargetRubricPage({
	params,
}: GradeTargetRubricPageProps) {
	return <GradeTargetRubricPageContent params={params} />;
}

async function GradeTargetRubricPageContent({
	params,
}: GradeTargetRubricPageProps) {
	const { projectId, targetId, rubricId } = await params;

	return (
		<AppPage>
			<RubricHeaderSection projectId={projectId} rubricId={rubricId} />
			<Suspense fallback={<GradeTargetCriterionSectionSkeleton />}>
				<GradeTargetCriterionSection
					rubricId={rubricId}
					targetId={targetId}
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
					key="grades"
					href={projectGradesPath({
						projectId: project.id,
						projectSlug: project.slug,
					})}
				>
					Grades
				</AppLink>,
				rubric.label ?? rubricId,
			]}
			title={rubric.label ?? rubricId}
		/>
	);
}

// No "use cache" here: `loadRubric`, `loadGradeTargets` and `loadRubricAssessment`
// each cache themselves. The criterion progress used by the lookup dialog is
// deliberately left uncached and unawaited at this scope so a save-then-navigate
// never blocks on recomputing it — it streams in via Suspense once the dialog
// opens (Finding 19).
async function GradeTargetCriterionSection({
	rubricId,
	targetId,
	projectId,
}: {
	rubricId: string;
	targetId: string;
	projectId: string;
}) {
	const project = await loadProjectByPublicId(projectId, { required: true });

	// Doesn't depend on `targets`, so it's started alongside the Promise.all
	// below rather than after it, keeping the progress work parallel and
	// shortening the wait if the lookup dialog is opened quickly.
	const criterionCountsPromise = loadAssessedCriterionCounts({
		rubricId,
		projectId: project.id,
	});

	const [rubric, targets, assessments] = await Promise.all([
		loadRubric({ rubricId, projectId: project.id }),
		loadGradeTargets({ projectId: project.id }),
		loadRubricAssessment({ targetId, rubricId, projectId: project.id }),
	]);
	const hasTarget = targets.some((target) => target.id === targetId);

	if (rubric == null || !hasTarget) {
		notFound();
	}

	// Reuses the targets already loaded above instead of querying them again
	// inside the progress primitive (Finding 7).
	const progressPromise = criterionCountsPromise.then((criterionCounts) =>
		buildAssessedCriterionCountsByTarget(
			targets.map((target) => target.id),
			criterionCounts,
		),
	);

	const criteriaWithAssessments = rubric.criteria.map((criterion) =>
		attachAssessment(criterion, assessments),
	);

	return (
		<GradeTargetAssessmentClient
			key={`${rubricId}-${targetId}`}
			projectId={project.id}
			projectSlug={project.slug}
			rubricId={rubricId}
			rubricLabel={rubric.label}
			criteria={criteriaWithAssessments}
			targets={targets}
			progressPromise={progressPromise}
			currentTargetId={targetId}
			saveAssessment={saveAssessment}
		/>
	);
}

// Mirrors `GradeTargetAssessmentClient`'s layout (current-target card,
// prev/next/lookup buttons, criterion rows) so the rubric header above stays in
// place and the page doesn't jump once assessment values and progress load.
function GradeTargetCriterionSectionSkeleton(): ReactElement {
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
