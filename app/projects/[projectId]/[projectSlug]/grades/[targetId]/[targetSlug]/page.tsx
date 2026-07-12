import { Group, Skeleton, Stack } from "@mantine/core";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { loadGradeTargetAssessments } from "#assessment-capture/assessments.ts";
import GradeTargetOverviewAssessmentClient from "#assessment-capture/GradeTargetOverviewAssessmentClient.tsx";
import { saveAssessment } from "#assessment-capture/saveAssessment.ts";
import { loadAssessmentCompletionByTarget } from "#assessment-completion/loadAssessmentCompletion.ts";
import { attachAssessment } from "#criteria/criterion.ts";
import AppLink from "#design-system/AppLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import PageHeader from "#design-system/PageHeader.tsx";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import { projectGradesPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadRubricsById } from "#rubrics/rubrics.ts";

type PageParams = {
	projectId: string;
	projectSlug: string;
	targetId: string;
	targetSlug: string;
};

type GradeTargetPageProps = { params: Promise<PageParams> };

export default function GradeTargetPage({ params }: GradeTargetPageProps) {
	return <GradeTargetPageContent params={params} />;
}

async function GradeTargetPageContent({ params }: GradeTargetPageProps) {
	const { targetId, projectId } = await params;

	const [project, targets] = await Promise.all([
		loadProjectByPublicId(projectId, { required: true }),
		loadGradeTargets({ projectId }),
	]);

	// Ensure the grade target belongs to the project and can be assessed.
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
						href={projectGradesPath({
							projectId: project.id,
							projectSlug: project.slug,
						})}
					>
						Grades
					</AppLink>,
					getGradeTargetLabel(currentTarget),
				]}
				title={getGradeTargetLabel(currentTarget)}
			/>

			<Suspense fallback={<GradeTargetGradingSectionSkeleton />}>
				<GradeTargetGradingSection
					projectId={project.id}
					projectSlug={project.slug}
					targetId={targetId}
					targets={targets}
				/>
			</Suspense>
		</AppPage>
	);
}

// No "use cache" here: a Suspense boundary inside a `"use cache"` scope fully
// resolves before being cached, so it can't stream — see `loadRubricsById`'s
// own cache and `progressPromise` below for why caching still works.
async function GradeTargetGradingSection({
	projectId,
	projectSlug,
	targetId,
	targets,
}: {
	projectId: string;
	projectSlug: string;
	targetId: string;
	targets: GradeTarget[];
}) {
	// Doesn't depend on `rubricsById`/`assessmentsByRubricId`, so it's started
	// alongside the Promise.all below rather than after it. Not awaited here:
	// only the on-demand lookup dialog needs it, so a save-then-navigate never
	// blocks on recomputing project-wide completion (Finding 19).
	const progressPromise = loadAssessmentCompletionByTarget({ projectId });
	progressPromise.catch(() => {});

	const [rubricsById, assessmentsByRubricId] = await Promise.all([
		loadRubricsById({ projectId }),
		loadGradeTargetAssessments({ targetId, projectId }),
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
		<GradeTargetOverviewAssessmentClient
			projectId={projectId}
			projectSlug={projectSlug}
			currentTargetId={targetId}
			targets={targets}
			progressPromise={progressPromise}
			rubrics={gradedRubrics}
			saveAssessment={saveAssessment}
		/>
	);
}

// Mirrors `GradeTargetOverviewAssessmentClient`'s layout (prev/next/lookup
// buttons, then criterion rows) so the breadcrumb/title above stay in place and
// the page doesn't jump once assessment values and progress load.
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
