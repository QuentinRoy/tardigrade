import { Progress, Skeleton, Stack, Text, Title } from "@mantine/core";
import { Suspense } from "react";
import AppButtonLink from "#design-system/AppButtonLink.tsx";
import AppNavLink from "#design-system/AppNavLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import { loadGradeCompletionByTarget } from "#grade-completion/loadGradeCompletion.ts";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import {
	gridGradeTargetPath,
	gridGradeTargetRubricPath,
	gridResultsPath,
	gridRubricsPath,
} from "#grids/gridPaths.ts";
import { loadGridByPublicId } from "#grids/grids.ts";
import RubricList from "#rubric-management/RubricList.tsx";
import { loadRubricsById } from "#rubrics/rubrics.ts";

type GridGradesPageProps = {
	params: Promise<{ gridId: string; gridSlug: string }>;
};

export default async function GridGradesPage({ params }: GridGradesPageProps) {
	const { gridId } = await params;
	return <GridGradesPageContent gridId={gridId} />;
}

// No page-level `"use cache"` wrapper: `loadGridByPublicId`, `loadRubricsById`
// and `loadGradeTargets` each cache themselves, and the grade-target completion below
// is deliberately left uncached at this scope so it can stream in under Suspense
// instead of blocking this render on a grid-wide completion recompute (Finding 19).
async function GridGradesPageContent({ gridId }: { gridId: string }) {
	const grid = await loadGridByPublicId(gridId, { required: true });

	const [rubricsById, targets] = await Promise.all([
		loadRubricsById({ gridId: grid.id }),
		loadGradeTargets({ gridId: grid.id }),
	]);

	const hasRubrics = Object.keys(rubricsById).length > 0;
	const firstTarget = targets[0];
	const rubrics = firstTarget
		? Object.entries(rubricsById).map(([id, { label }]) => ({
				id,
				label: label == null ? id : label,
				href: gridGradeTargetRubricPath({
					gridId: grid.id,
					gridSlug: grid.slug,
					targetId: firstTarget.id,
					targetSlug: firstTarget.slug ?? firstTarget.id,
					rubricId: id,
				}),
			}))
		: [];

	return (
		<AppPage>
			<Stack gap="lg">
				<Title order={1}>Grading</Title>
				<AppButtonLink
					href={gridResultsPath({ gridId: grid.id, gridSlug: grid.slug })}
					variant="outline"
				>
					Open results
				</AppButtonLink>
				{!hasRubrics ? (
					<Stack gap="sm" align="flex-start">
						<Text c="dimmed">
							No rubrics yet — add rubrics to start grading.
						</Text>
						<AppButtonLink
							href={gridRubricsPath({ gridId: grid.id, gridSlug: grid.slug })}
						>
							Add rubrics
						</AppButtonLink>
					</Stack>
				) : (
					<>
						<Stack gap="sm">
							<Title order={2}>Grade by student or group</Title>
							<Suspense
								fallback={
									<GradeTargetListSkeleton
										gridId={grid.id}
										gridSlug={grid.slug}
										targets={targets}
									/>
								}
							>
								<GradeTargetCompletionList
									gridId={grid.id}
									gridSlug={grid.slug}
									targets={targets}
								/>
							</Suspense>
						</Stack>
						<Stack gap="sm">
							<Title order={2}>Grade by rubric</Title>
							{firstTarget ? (
								<RubricList rubrics={rubrics} />
							) : (
								<Text c="dimmed">
									Add a student or group first to start grading by rubric.
								</Text>
							)}
						</Stack>
					</>
				)}
			</Stack>
		</AppPage>
	);
}

async function GradeTargetCompletionList({
	gridId,
	gridSlug,
	targets,
}: {
	gridId: string;
	gridSlug: string;
	targets: GradeTarget[];
}) {
	const completionByTargetId = await loadGradeCompletionByTarget({ gridId });

	return (
		<Stack component="nav" aria-label="Students and groups" gap="xs">
			{targets.map((target) => {
				const completion = completionByTargetId[target.id];
				const completed = completion?.completed ?? 0;
				const total = completion?.total ?? 0;
				const percent = total > 0 ? (completed / total) * 100 : 0;
				const isComplete = completed === total && total > 0;
				return (
					<AppNavLink
						key={target.id}
						href={gridGradeTargetPath({
							gridId,
							gridSlug,
							targetId: target.id,
							targetSlug: target.slug ?? target.id,
						})}
						label={getGradeTargetLabel(target)}
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

// Mirrors `GradeTargetCompletionList`'s layout so the target links and labels
// are clickable immediately, with placeholders standing in for completion while
// it streams in (Finding 19: a save must not block the next navigation on a
// grid-wide completion recompute).
function GradeTargetListSkeleton({
	gridId,
	gridSlug,
	targets,
}: {
	gridId: string;
	gridSlug: string;
	targets: GradeTarget[];
}) {
	return (
		<Stack component="nav" aria-label="Students and groups" gap="xs">
			{targets.map((target) => (
				<AppNavLink
					key={target.id}
					href={gridGradeTargetPath({
						gridId,
						gridSlug,
						targetId: target.id,
						targetSlug: target.slug ?? target.id,
					})}
					label={getGradeTargetLabel(target)}
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
