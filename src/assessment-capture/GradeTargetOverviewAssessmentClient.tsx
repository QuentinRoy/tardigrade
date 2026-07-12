"use client";

import { Button, Group, Stack, Text, Title } from "@mantine/core";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { AssessedCriterion } from "#criteria/types.ts";
import {
	type SaveError,
	useSaveErrors,
} from "#design-system/SaveErrorsProvider.tsx";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import { projectGradeTargetPath } from "#projects/projectPaths.ts";
import AssessmentProgressSummary from "./AssessmentProgressSummary.tsx";
import { summarizeCriteria } from "./assessmentSummary.ts";
import CriterionGradeList from "./CriterionGradeList.tsx";
import GradeTargetSelector from "./GradeTargetSelector.tsx";
import { getGradeTargetNavigation } from "./gradeTargetNavigation.ts";
import type { SaveAssessment } from "./saveCriterionAssessment.ts";
import { saveCriterionAssessment } from "./saveCriterionAssessment.ts";
import { useAssessmentSession } from "./useAssessmentSession.ts";
import { useGradeTargetQuickJump } from "./useGradeTargetQuickJump.ts";

type RubricAssessmentSection = {
	rubricId: string;
	rubricLabel: string;
	criteria: AssessedCriterion[];
};

type OptimisticRubricSection = {
	rubricId: string;
	rubricLabel: string;
	criteria: AssessedCriterion[];
	flatIndices: Array<number | undefined>;
};

type GradeTargetOverviewAssessmentClientProps = {
	projectId: string;
	projectSlug: string;
	rubrics: RubricAssessmentSection[];
	targets: GradeTarget[];
	progressPromise: Promise<
		Record<string, { completed: number; total: number }>
	>;
	currentTargetId: string;
	// Injected rather than imported, so this component never statically
	// imports the "use server" saveAssessment module. The page passes the
	// real server action; stories pass a plain stub.
	saveAssessment: SaveAssessment;
};

export default function GradeTargetOverviewAssessmentClient({
	projectId,
	projectSlug,
	rubrics: initialRubrics,
	targets,
	progressPromise,
	currentTargetId,
	saveAssessment,
}: GradeTargetOverviewAssessmentClientProps): ReactElement {
	const router = useRouter();
	const { addError } = useSaveErrors();
	const quickJump = useGradeTargetQuickJump();

	const { currentTarget } = getGradeTargetNavigation(targets, currentTargetId);
	const currentTargetLabel =
		currentTarget != null ? getGradeTargetLabel(currentTarget) : undefined;

	const { initialCriteria, criterionInfoByCriterionId } = useMemo(() => {
		const criteria: AssessedCriterion[] = [];
		const infoMap = new Map<
			string,
			{ rubricId: string; rubricLabel: string }
		>();

		for (const rubric of initialRubrics) {
			for (const criterion of rubric.criteria) {
				criteria.push(criterion);
				infoMap.set(criterion.id, {
					rubricId: rubric.rubricId,
					rubricLabel: rubric.rubricLabel,
				});
			}
		}

		return { initialCriteria: criteria, criterionInfoByCriterionId: infoMap };
	}, [initialRubrics]);

	const {
		currentTargetIndex,
		previousTarget,
		nextTarget,
		savedCriteria,
		optimisticCriteria,
		pendingByIndex,
		assess,
	} = useAssessmentSession<Omit<SaveError, "id">>({
		initialCriteria,
		targets,
		currentTargetId,
		saveAssessment: async (criterion, assessment) => {
			const info = criterionInfoByCriterionId.get(criterion.id);
			const baseErrorContext = {
				projectId,
				projectSlug,
				targetId: currentTargetId,
				targetSlug: currentTarget?.slug ?? currentTargetId,
				targetLabel: currentTargetLabel,
			};

			if (info == null) {
				return {
					success: false,
					error: {
						...baseErrorContext,
						rubricId: "unknown-rubric",
						rubricLabel: "Unknown rubric",
						message: `Unknown criterion mapping for ${criterion.id}`,
					},
				};
			}

			return saveCriterionAssessment({
				saveAssessment,
				projectId,
				targetId: currentTargetId,
				rubricId: info.rubricId,
				assessment,
				errorContext: {
					...baseErrorContext,
					rubricId: info.rubricId,
					rubricLabel: info.rubricLabel,
				},
			});
		},
		onError: addError,
	});

	const optimisticRubrics = useMemo<OptimisticRubricSection[]>(() => {
		const criterionToFlatIndex = new Map<string, number>();

		for (let i = 0; i < optimisticCriteria.length; i++) {
			const optimisticCriterion = optimisticCriteria[i];
			if (optimisticCriterion == null) {
				continue;
			}
			criterionToFlatIndex.set(optimisticCriterion.id, i);
		}

		return initialRubrics.map((rubric) => ({
			rubricId: rubric.rubricId,
			rubricLabel: rubric.rubricLabel,
			criteria: rubric.criteria.map((criterion) => {
				const flatIndex = criterionToFlatIndex.get(criterion.id);
				return flatIndex != null
					? (optimisticCriteria[flatIndex] ?? criterion)
					: criterion;
			}),
			flatIndices: rubric.criteria.map((criterion) =>
				criterionToFlatIndex.get(criterion.id),
			),
		}));
	}, [initialRubrics, optimisticCriteria]);

	const summary = summarizeCriteria(optimisticCriteria);

	const navigateToTarget = (targetId: string) => {
		const target = targets.find((candidate) => candidate.id === targetId);
		router.push(
			projectGradeTargetPath({
				projectId,
				projectSlug,
				targetId,
				targetSlug: target?.slug ?? targetId,
			}),
		);
	};

	if (currentTarget == null) {
		return <Text>No students or groups found in database.</Text>;
	}

	return (
		<Stack gap="xl">
			<GradeTargetNavigation
				projectId={projectId}
				projectSlug={projectSlug}
				currentTargetId={currentTargetId}
				currentTargetIndex={currentTargetIndex}
				totalTargets={targets.length}
				previousTarget={previousTarget}
				nextTarget={nextTarget}
				onOpenLookup={quickJump.open}
			/>

			<GradeTargetSelector
				open={quickJump.isOpen}
				onClose={quickJump.close}
				onSelectTarget={navigateToTarget}
				targets={targets}
				progressPromise={progressPromise}
				progressLabel="rubrics"
			/>

			{optimisticRubrics.length === 0 ? (
				<Text>No rubrics found in database.</Text>
			) : (
				<Stack gap="xl">
					{optimisticRubrics.map((rubric) => {
						const { marks: rubricMarks, maxMarks: rubricMaxMarks } =
							summarizeCriteria(rubric.criteria);

						return (
							<Stack key={rubric.rubricId} gap="md">
								<Group justify="space-between" align="baseline" gap="xs">
									<Title m="0" order={2}>
										{rubric.rubricLabel}
									</Title>
									<Text size="sm">
										({rubricMarks}&nbsp;/&nbsp;{rubricMaxMarks})
									</Text>
								</Group>

								{rubric.criteria.map((criterion, localIndex) => {
									const flatIndex = rubric.flatIndices[localIndex];
									const savedCriterion =
										flatIndex != null
											? (savedCriteria[flatIndex] ?? criterion)
											: criterion;
									return (
										<CriterionGradeList
											key={criterion.id}
											savedCriteria={[savedCriterion]}
											criteria={[criterion]}
											pendingByIndex={{
												0:
													flatIndex != null
														? (pendingByIndex[flatIndex] ?? 0)
														: 0,
											}}
											disabled={false}
											onAssess={(_, assessment) => {
												if (flatIndex != null) {
													assess(flatIndex, assessment);
												}
											}}
										/>
									);
								})}
							</Stack>
						);
					})}
				</Stack>
			)}

			<AssessmentProgressSummary
				marks={summary.marks}
				maxMarks={summary.maxMarks}
				completedCriteria={summary.completedCriteria}
				totalCriteria={summary.totalCriteria}
			/>
		</Stack>
	);
}

function GradeTargetNavigation({
	projectId,
	projectSlug,
	currentTargetId,
	currentTargetIndex,
	totalTargets,
	previousTarget,
	nextTarget,
	onOpenLookup,
}: {
	projectId: string;
	projectSlug: string;
	currentTargetId: string;
	currentTargetIndex: number;
	totalTargets: number;
	previousTarget?: GradeTarget | undefined;
	nextTarget?: GradeTarget | undefined;
	onOpenLookup: () => void;
}): ReactElement {
	return (
		<Group gap="xs" wrap="wrap">
			<Button
				component={NextLink}
				href={projectGradeTargetPath({
					projectId,
					projectSlug,
					targetId: previousTarget?.id ?? currentTargetId,
					targetSlug: previousTarget?.slug ?? currentTargetId,
				})}
				prefetch={previousTarget != null}
				variant="outline"
				disabled={previousTarget == null}
			>
				Previous
			</Button>
			<Button
				component={NextLink}
				href={projectGradeTargetPath({
					projectId,
					projectSlug,
					targetId: nextTarget?.id ?? currentTargetId,
					targetSlug: nextTarget?.slug ?? currentTargetId,
				})}
				prefetch={nextTarget != null}
				variant="outline"
				disabled={nextTarget == null}
			>
				Next
			</Button>
			<Button onClick={onOpenLookup}>Lookup</Button>
			<Text size="sm">
				{currentTargetIndex + 1} / {totalTargets} students and groups
			</Text>
		</Group>
	);
}
