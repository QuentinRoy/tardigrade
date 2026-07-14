import { Group, Skeleton, Stack } from "@mantine/core";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { attachGrade } from "#criteria/criterion.ts";
import AppLink from "#design-system/AppLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import { loadGradeCompletionByTarget } from "#grade-completion/loadGradeCompletion.ts";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import GradeTargetGradingClient from "#grading/GradeTargetGradingClient.tsx";
import { loadGradeTargetGrades } from "#grading/grades.ts";
import { saveCriterionGrade } from "#grading/saveCriterionGrade.ts";
import { gridGradesPath } from "#grids/gridPaths.ts";
import { loadGridByPublicId } from "#grids/grids.ts";
import { loadRubricsById } from "#rubrics/rubrics.ts";

type PageParams = {
	gridId: string;
	gridSlug: string;
	targetId: string;
	targetSlug: string;
};

type GradeTargetPageProps = { params: Promise<PageParams> };

export default function GradeTargetPage({ params }: GradeTargetPageProps) {
	return <GradeTargetPageContent params={params} />;
}

async function GradeTargetPageContent({ params }: GradeTargetPageProps) {
	const { targetId, gridId } = await params;

	const [grid, targets] = await Promise.all([
		loadGridByPublicId(gridId, { required: true }),
		loadGradeTargets({ gridId }),
	]);

	// Ensure the grade target belongs to the grid and can be graded.
	const currentTarget = targets.find((t) => t.id === targetId);
	if (currentTarget == null) {
		notFound();
	}

	return (
		<AppPage>
			<PageHeader
				breadcrumbs={[
					<AppLink
						key="grades"
						href={gridGradesPath({ gridId: grid.id, gridSlug: grid.slug })}
					>
						Grading
					</AppLink>,
					getGradeTargetLabel(currentTarget),
				]}
				title={getGradeTargetLabel(currentTarget)}
			/>

			<Suspense fallback={<GradeTargetGradingSectionSkeleton />}>
				<GradeTargetGradingSection
					gridId={grid.id}
					gridSlug={grid.slug}
					targetId={targetId}
					targets={targets}
				/>
			</Suspense>
		</AppPage>
	);
}

// No "use cache" here: a Suspense boundary inside a `"use cache"` scope fully
// resolves before being cached, so it can't stream — see `loadRubricsById`'s
// own cache and `completionPromise` below for why caching still works.
async function GradeTargetGradingSection({
	gridId,
	gridSlug,
	targetId,
	targets,
}: {
	gridId: string;
	gridSlug: string;
	targetId: string;
	targets: GradeTarget[];
}) {
	// Doesn't depend on `rubricsById`/`gradesByRubricId`, so it's started
	// alongside the Promise.all below rather than after it. Not awaited here:
	// only the on-demand lookup dialog needs it, so a save-then-navigate never
	// blocks on recomputing grid-wide completion (Finding 19).
	const completionPromise = loadGradeCompletionByTarget({ gridId });
	completionPromise.catch(() => {});

	const [rubricsById, gradesByRubricId] = await Promise.all([
		loadRubricsById({ gridId }),
		loadGradeTargetGrades({ targetId, gridId }),
	]);

	const gradedRubrics = Object.entries(rubricsById).map(
		([rubricId, rubric]) => ({
			rubricId,
			rubricLabel: rubric.label ?? rubricId,
			criteria: rubric.criteria.map((criterion) =>
				attachGrade(criterion, gradesByRubricId[rubricId]),
			),
		}),
	);

	return (
		<GradeTargetGradingClient
			gridId={gridId}
			gridSlug={gridSlug}
			currentTargetId={targetId}
			targets={targets}
			completionPromise={completionPromise}
			rubrics={gradedRubrics}
			saveCriterionGrade={saveCriterionGrade}
		/>
	);
}

// Mirrors `GradeTargetGradingClient`'s layout (prev/next/lookup
// buttons, then criterion rows) so the breadcrumb/title above stay in place and
// the page doesn't jump once grade values and completion load.
function GradeTargetGradingSectionSkeleton(): ReactElement {
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
