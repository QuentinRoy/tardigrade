import { Card, Group, Skeleton, Stack } from "@mantine/core";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { attachGrade } from "#criteria/criterion.ts";
import { cacheTags, gridCacheTag, rubricListCacheTag } from "#db/cacheTags.ts";
import AppLink from "#design-system/AppLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import {
	buildGradedCriterionCountsByTarget,
	loadGradedCriterionCounts,
} from "#grade-completion/loadGradeCompletion.ts";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import { loadRubricGrade } from "#grading/grades.ts";
import RubricGradingClient from "#grading/RubricGradingClient.tsx";
import { saveCriterionGrade } from "#grading/saveCriterionGrade.ts";
import { gridGradesPath } from "#grids/gridPaths.ts";
import { loadGridByPublicId } from "#grids/grids.ts";
import { loadRubric } from "#rubrics/rubrics.ts";

type PageParams = {
	gridId: string;
	gridSlug: string;
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
	const { gridId, targetId, rubricId } = await params;

	return (
		<AppPage>
			<RubricHeaderSection gridId={gridId} rubricId={rubricId} />
			<Suspense fallback={<GradeTargetCriterionSectionSkeleton />}>
				<GradeTargetCriterionSection
					rubricId={rubricId}
					targetId={targetId}
					gridId={gridId}
				/>
			</Suspense>
		</AppPage>
	);
}

async function RubricHeaderSection({
	gridId,
	rubricId,
}: {
	gridId: string;
	rubricId: string;
}) {
	"use cache";
	cacheTags(gridCacheTag(gridId), rubricListCacheTag());

	const grid = await loadGridByPublicId(gridId, { required: true });

	const rubric = await loadRubric({ rubricId, gridId: grid.id });

	if (rubric == null) {
		notFound();
	}

	return (
		<PageHeader
			breadcrumbs={[
				<AppLink
					key="grades"
					href={gridGradesPath({ gridId: grid.id, gridSlug: grid.slug })}
				>
					Grades
				</AppLink>,
				rubric.label ?? rubricId,
			]}
			title={rubric.label ?? rubricId}
		/>
	);
}

// No "use cache" here: `loadRubric`, `loadGradeTargets` and `loadRubricGrade`
// each cache themselves. The criterion completion used by the lookup dialog is
// deliberately left uncached and unawaited at this scope so a save-then-navigate
// never blocks on recomputing it — it streams in via Suspense once the dialog
// opens (Finding 19).
async function GradeTargetCriterionSection({
	rubricId,
	targetId,
	gridId,
}: {
	rubricId: string;
	targetId: string;
	gridId: string;
}) {
	const grid = await loadGridByPublicId(gridId, { required: true });

	// Doesn't depend on `targets`, so it's started alongside the Promise.all
	// below rather than after it, keeping the completion work parallel and
	// shortening the wait if the lookup dialog is opened quickly.
	const criterionCountsPromise = loadGradedCriterionCounts({
		rubricId,
		gridId: grid.id,
	});

	const [rubric, targets, grades] = await Promise.all([
		loadRubric({ rubricId, gridId: grid.id }),
		loadGradeTargets({ gridId: grid.id }),
		loadRubricGrade({ targetId, rubricId, gridId: grid.id }),
	]);
	const hasTarget = targets.some((target) => target.id === targetId);

	if (rubric == null || !hasTarget) {
		notFound();
	}

	// Reuses the targets already loaded above instead of querying them again
	// inside the completion primitive (Finding 7).
	const completionPromise = criterionCountsPromise.then((criterionCounts) =>
		buildGradedCriterionCountsByTarget(
			targets.map((target) => target.id),
			criterionCounts,
		),
	);

	const criteriaWithGrades = rubric.criteria.map((criterion) =>
		attachGrade(criterion, grades),
	);

	return (
		<RubricGradingClient
			key={`${rubricId}-${targetId}`}
			gridId={grid.id}
			gridSlug={grid.slug}
			rubricId={rubricId}
			rubricLabel={rubric.label}
			criteria={criteriaWithGrades}
			targets={targets}
			completionPromise={completionPromise}
			currentTargetId={targetId}
			saveCriterionGrade={saveCriterionGrade}
		/>
	);
}

// Mirrors `RubricGradingClient`'s layout (current-target card,
// prev/next/lookup buttons, criterion rows) so the rubric header above stays in
// place and the page doesn't jump once grade values and completion load.
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
