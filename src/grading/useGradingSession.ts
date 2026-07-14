"use client";

import { produce } from "immer";
import { startTransition, useOptimistic, useReducer } from "react";
import { attachGrade } from "#criteria/criterion.ts";
import type { CriterionGrade, GradedCriterion } from "#criteria/types.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import { useBeforeUnloadGuard } from "#utils/useBeforeUnloadGuard.ts";
import { getGradeTargetNavigation } from "./gradeTargetNavigation.ts";

export type SaveResult<TError> =
	| { success: true }
	| { success: false; error: TError };

export type UseGradingSessionConfig<TError> = {
	initialCriteria: GradedCriterion[];
	targets: GradeTarget[];
	currentTargetId: string;
	saveCriterionGrade: (
		criterion: GradedCriterion,
		grade: CriterionGrade,
	) => Promise<SaveResult<TError>>;
	onError: (error: TError) => void;
};

export type UseGradingSessionResult = {
	currentTargetIndex: number;
	currentTarget: GradeTarget | undefined;
	previousTarget: GradeTarget | undefined;
	nextTarget: GradeTarget | undefined;
	savedCriteria: GradedCriterion[];
	optimisticCriteria: GradedCriterion[];
	pendingByIndex: Record<number, number>;
	gradeCriterion: (index: number, grade: CriterionGrade) => void;
};

type State = {
	savedCriteria: GradedCriterion[];
	pendingByIndex: Record<number, number>;
};

type Action =
	| { kind: "save-start"; index: number }
	| { kind: "save-success"; index: number; grade: CriterionGrade }
	| { kind: "save-failure"; index: number };

export function useGradingSession<TError>({
	initialCriteria,
	targets,
	currentTargetId,
	saveCriterionGrade,
	onError,
}: UseGradingSessionConfig<TError>): UseGradingSessionResult {
	const [{ savedCriteria, pendingByIndex }, dispatch] = useReducer(reducer, {
		savedCriteria: initialCriteria,
		pendingByIndex: {},
	});

	const pendingCount = Object.values(pendingByIndex).reduce(
		(total, count) => total + count,
		0,
	);
	useBeforeUnloadGuard(pendingCount > 0);

	const [optimisticCriteria, addOptimisticUpdate] = useOptimistic(
		savedCriteria,
		(current, { index, grade }: { index: number; grade: CriterionGrade }) =>
			current.map((criterion, i) =>
				i === index ? attachGrade(criterion, grade) : criterion,
			),
	);

	const { currentTargetIndex, currentTarget, previousTarget, nextTarget } =
		getGradeTargetNavigation(targets, currentTargetId);

	function gradeCriterion(index: number, grade: CriterionGrade) {
		const criterion = savedCriteria[index];

		if (criterion == null || isSameGrade(criterion, grade)) {
			return;
		}

		dispatch({ kind: "save-start", index });

		startTransition(async () => {
			addOptimisticUpdate({ index, grade });

			const result = await saveCriterionGrade(criterion, grade);

			if (result.success) {
				dispatch({ kind: "save-success", index, grade });
				return;
			}

			dispatch({ kind: "save-failure", index });
			onError(result.error);
		});
	}

	return {
		currentTargetIndex,
		currentTarget,
		previousTarget,
		nextTarget,
		savedCriteria,
		optimisticCriteria,
		pendingByIndex,
		gradeCriterion,
	};
}

function reducer(state: State, action: Action): State {
	return produce(state, (draft) => {
		switch (action.kind) {
			case "save-start": {
				draft.pendingByIndex[action.index] =
					(draft.pendingByIndex[action.index] ?? 0) + 1;
				break;
			}
			case "save-success": {
				draft.pendingByIndex[action.index] = Math.max(
					0,
					(draft.pendingByIndex[action.index] ?? 0) - 1,
				);
				const savedCriterion = draft.savedCriteria[action.index];
				if (savedCriterion == null) {
					break;
				}
				draft.savedCriteria[action.index] = attachGrade(
					savedCriterion,
					action.grade,
				);
				break;
			}
			case "save-failure": {
				draft.pendingByIndex[action.index] = Math.max(
					0,
					(draft.pendingByIndex[action.index] ?? 0) - 1,
				);
				break;
			}
			default:
				break;
		}
	});
}

function isSameGrade(
	criterion: GradedCriterion,
	grade: CriterionGrade,
): boolean {
	if (
		criterion.grade == null ||
		grade.criterionId !== criterion.id ||
		grade.kind !== criterion.kind
	) {
		return false;
	}

	if (criterion.kind === "check" && grade.kind === "check") {
		return criterion.grade.passed === grade.passed;
	}

	if (criterion.kind === "options" && grade.kind === "options") {
		return criterion.grade.selectedLabel === grade.selectedLabel;
	}

	if (criterion.kind === "number" && grade.kind === "number") {
		return criterion.grade.value === grade.value;
	}

	return false;
}
