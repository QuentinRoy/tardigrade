import { Progress, Skeleton, Stack, Text, Title } from "@mantine/core";
import { Suspense } from "react";
import { loadAssessmentCompletionByTarget } from "#assessment-completion/loadAssessmentCompletion.ts";
import AppButtonLink from "#design-system/AppButtonLink.tsx";
import AppNavLink from "#design-system/AppNavLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import {
	projectGradeTargetPath,
	projectGradeTargetRubricPath,
	projectResultsPath,
	projectRubricsPath,
} from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import RubricList from "#rubric-management/RubricList.tsx";
import { loadRubricsById } from "#rubrics/rubrics.ts";

type ProjectGradesPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectGradesPage({
	params,
}: ProjectGradesPageProps) {
	const { projectId } = await params;
	return <ProjectGradesPageContent projectId={projectId} />;
}

// No page-level `"use cache"` wrapper: `loadProjectByPublicId`, `loadRubricsById`
// and `loadGradeTargets` each cache themselves, and the grade-target progress below
// is deliberately left uncached at this scope so it can stream in under Suspense
// instead of blocking this render on a project-wide completion recompute (Finding 19).
async function ProjectGradesPageContent({ projectId }: { projectId: string }) {
	const project = await loadProjectByPublicId(projectId, { required: true });

	const [rubricsById, targets] = await Promise.all([
		loadRubricsById({ projectId: project.id }),
		loadGradeTargets({ projectId: project.id }),
	]);

	const hasRubrics = Object.keys(rubricsById).length > 0;
	const firstTarget = targets[0];
	const rubrics = firstTarget
		? Object.entries(rubricsById).map(([id, { label }]) => ({
				id,
				label: label == null ? id : label,
				href: projectGradeTargetRubricPath({
					projectId: project.id,
					projectSlug: project.slug,
					targetId: firstTarget.id,
					targetSlug: firstTarget.slug ?? firstTarget.id,
					rubricId: id,
				}),
			}))
		: [];

	return (
		<AppPage>
			<Stack gap="lg">
				<Title order={1}>Grades</Title>
				<AppButtonLink
					href={projectResultsPath({
						projectId: project.id,
						projectSlug: project.slug,
					})}
					variant="outline"
				>
					Open results
				</AppButtonLink>
				{!hasRubrics ? (
					<Stack gap="sm" align="flex-start">
						<Text c="dimmed">
							No rubrics yet — add rubrics to start assessing.
						</Text>
						<AppButtonLink
							href={projectRubricsPath({
								projectId: project.id,
								projectSlug: project.slug,
							})}
						>
							Add rubrics
						</AppButtonLink>
					</Stack>
				) : (
					<>
						<Stack gap="sm">
							<Title order={2}>Assess by student or group</Title>
							<Suspense
								fallback={
									<GradeTargetListSkeleton
										projectId={project.id}
										projectSlug={project.slug}
										targets={targets}
									/>
								}
							>
								<GradeTargetProgressList
									projectId={project.id}
									projectSlug={project.slug}
									targets={targets}
								/>
							</Suspense>
						</Stack>
						<Stack gap="sm">
							<Title order={2}>Assess by rubric</Title>
							{firstTarget ? (
								<RubricList rubrics={rubrics} />
							) : (
								<Text c="dimmed">
									Add a student or group first to start assessments by rubric.
								</Text>
							)}
						</Stack>
					</>
				)}
			</Stack>
		</AppPage>
	);
}

async function GradeTargetProgressList({
	projectId,
	projectSlug,
	targets,
}: {
	projectId: string;
	projectSlug: string;
	targets: GradeTarget[];
}) {
	const progressByTargetId = await loadAssessmentCompletionByTarget({
		projectId,
	});

	return (
		<Stack component="nav" aria-label="Students and groups" gap="xs">
			{targets.map((target) => {
				const progress = progressByTargetId[target.id];
				const completed = progress?.completed ?? 0;
				const total = progress?.total ?? 0;
				const percent = total > 0 ? (completed / total) * 100 : 0;
				const isComplete = completed === total && total > 0;
				return (
					<AppNavLink
						key={target.id}
						href={projectGradeTargetPath({
							projectId,
							projectSlug,
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

// Mirrors `GradeTargetProgressList`'s layout so the target links and labels
// are clickable immediately, with placeholders standing in for progress while
// it streams in (Finding 19: a save must not block the next navigation on a
// project-wide completion recompute).
function GradeTargetListSkeleton({
	projectId,
	projectSlug,
	targets,
}: {
	projectId: string;
	projectSlug: string;
	targets: GradeTarget[];
}) {
	return (
		<Stack component="nav" aria-label="Students and groups" gap="xs">
			{targets.map((target) => (
				<AppNavLink
					key={target.id}
					href={projectGradeTargetPath({
						projectId,
						projectSlug,
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
