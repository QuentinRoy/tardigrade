"use client";

import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import type { GradedCriterion } from "#criteria/types.ts";
import {
	type SaveError,
	useSaveErrors,
} from "#design-system/SaveErrorsProvider.tsx";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import { projectGradeTargetRubricPath } from "#projects/projectPaths.ts";
import CompletionSummary from "./CompletionSummary.tsx";
import CriterionGradeList from "./CriterionGradeList.tsx";
import GradeTargetSelector from "./GradeTargetSelector.tsx";
import { summarizeCriteria } from "./gradeSummary.ts";
import { getGradeTargetNavigation } from "./gradeTargetNavigation.ts";
import type { SaveCriterionGrade } from "./trySaveCriterionGrade.ts";
import { trySaveCriterionGrade } from "./trySaveCriterionGrade.ts";
import { useGradeTargetQuickJump } from "./useGradeTargetQuickJump.ts";
import { useGradingSession } from "./useGradingSession.ts";

type RubricGradingClientProps = {
	projectId: string;
	projectSlug: string;
	rubricId: string;
	rubricLabel?: string | undefined;
	criteria: GradedCriterion[];
	targets: GradeTarget[];
	completionPromise: Promise<
		Record<string, { completed: number; total: number }>
	>;
	currentTargetId: string;
	// Injected rather than imported, so this component never statically
	// imports the "use server" saveCriterionGrade module. The page passes the
	// real server action; stories pass a plain stub.
	saveCriterionGrade: SaveCriterionGrade;
};

export default function RubricGradingClient({
	projectId,
	projectSlug,
	rubricId,
	rubricLabel,
	criteria: initialCriteria,
	targets,
	completionPromise,
	currentTargetId,
	saveCriterionGrade,
}: RubricGradingClientProps): ReactElement {
	const router = useRouter();
	const { addError } = useSaveErrors();
	const quickJump = useGradeTargetQuickJump();

	const { currentTarget } = getGradeTargetNavigation(targets, currentTargetId);
	const currentTargetLabel =
		currentTarget != null ? getGradeTargetLabel(currentTarget) : undefined;

	const {
		currentTargetIndex,
		previousTarget,
		nextTarget,
		savedCriteria,
		optimisticCriteria,
		pendingByIndex,
		gradeCriterion,
	} = useGradingSession<Omit<SaveError, "id">>({
		initialCriteria,
		targets,
		currentTargetId,
		saveCriterionGrade: (_criterion, grade) =>
			trySaveCriterionGrade({
				saveCriterionGrade,
				projectId,
				targetId: currentTargetId,
				rubricId,
				grade,
				errorContext: {
					projectId,
					projectSlug,
					targetId: currentTargetId,
					targetSlug: currentTarget?.slug ?? currentTargetId,
					targetLabel: currentTargetLabel,
					rubricId,
					rubricLabel,
				},
			}),
		onError: addError,
	});

	const { marks, maxMarks, completedCriteria, totalCriteria } =
		summarizeCriteria(optimisticCriteria);
	const isCompleted = totalCriteria > 0 && completedCriteria === totalCriteria;

	const navigateToTarget = (targetId: string) => {
		const target = targets.find((candidate) => candidate.id === targetId);
		router.push(
			projectGradeTargetRubricPath({
				projectId,
				projectSlug,
				targetId,
				targetSlug: target?.slug ?? targetId,
				rubricId,
			}),
		);
	};

	if (currentTarget == null) {
		return <Text>No students or groups found in database.</Text>;
	}

	return (
		<Stack gap="xl">
			<Card withBorder padding="md">
				<Text size="sm" c="dimmed">
					Current student or group
				</Text>
				<Title order={3}>{getGradeTargetLabel(currentTarget)}</Title>
				<Text size="sm" c="dimmed">
					{currentTarget.id}
				</Text>
			</Card>
			<Group gap="xs" wrap="wrap">
				<Button
					component={NextLink}
					href={projectGradeTargetRubricPath({
						projectId,
						projectSlug,
						targetId: previousTarget?.id ?? currentTargetId,
						targetSlug: previousTarget?.slug ?? currentTargetId,
						rubricId,
					})}
					prefetch={previousTarget != null}
					variant="outline"
					{...(!isCompleted && { color: "gray" })}
					disabled={previousTarget == null}
				>
					Previous
				</Button>
				<Button
					component={NextLink}
					href={projectGradeTargetRubricPath({
						projectId,
						projectSlug,
						targetId: nextTarget?.id ?? currentTargetId,
						targetSlug: nextTarget?.slug ?? currentTargetId,
						rubricId,
					})}
					prefetch={nextTarget != null}
					variant="outline"
					{...(!isCompleted && { color: "gray" })}
					disabled={nextTarget == null}
				>
					Next
				</Button>
				<Button onClick={quickJump.open}>Lookup</Button>
				<Text size="sm">
					{currentTargetIndex + 1} / {targets.length}
				</Text>
			</Group>
			<GradeTargetSelector
				open={quickJump.isOpen}
				onClose={quickJump.close}
				onSelectTarget={navigateToTarget}
				targets={targets}
				completionPromise={completionPromise}
				progressLabel="criteria"
			/>
			<CriterionGradeList
				savedCriteria={savedCriteria}
				criteria={optimisticCriteria}
				pendingByIndex={pendingByIndex}
				disabled={false}
				onGrade={(index, grade) => gradeCriterion(index, grade)}
			/>
			<CompletionSummary
				marks={marks}
				maxMarks={maxMarks}
				completedCriteria={completedCriteria}
				totalCriteria={totalCriteria}
			/>
		</Stack>
	);
}
