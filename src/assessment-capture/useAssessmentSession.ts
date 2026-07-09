"use client";

import { produce } from "immer";
import { startTransition, useOptimistic, useReducer } from "react";
import { attachAssessment } from "#criteria/criterion.ts";
import type {
	AssessedCriterion,
	AssessmentCriterionValue,
} from "#criteria/types.ts";
import type { Submission } from "#submissions/types.ts";
import { useBeforeUnloadGuard } from "#utils/useBeforeUnloadGuard.ts";
import { getSubmissionNavigation } from "./submissionNavigation.ts";

export type SaveResult<TError> =
	| { success: true }
	| { success: false; error: TError };

export type UseAssessmentSessionConfig<TError> = {
	initialCriteria: AssessedCriterion[];
	submissions: Submission[];
	currentSubmissionId: string;
	saveAssessment: (
		criterion: AssessedCriterion,
		assessment: AssessmentCriterionValue,
	) => Promise<SaveResult<TError>>;
	onError: (error: TError) => void;
};

export type UseAssessmentSessionResult = {
	currentSubmissionIndex: number;
	currentSubmission: Submission | undefined;
	previousSubmission: Submission | undefined;
	nextSubmission: Submission | undefined;
	savedCriteria: AssessedCriterion[];
	optimisticCriteria: AssessedCriterion[];
	pendingByIndex: Record<number, number>;
	assess: (index: number, assessment: AssessmentCriterionValue) => void;
};

type State = {
	savedCriteria: AssessedCriterion[];
	pendingByIndex: Record<number, number>;
};

type Action =
	| { kind: "save-start"; index: number }
	| {
			kind: "save-success";
			index: number;
			assessment: AssessmentCriterionValue;
	  }
	| { kind: "save-failure"; index: number };

export function useAssessmentSession<TError>({
	initialCriteria,
	submissions,
	currentSubmissionId,
	saveAssessment,
	onError,
}: UseAssessmentSessionConfig<TError>): UseAssessmentSessionResult {
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
		(
			current,
			{
				index,
				assessment,
			}: { index: number; assessment: AssessmentCriterionValue },
		) =>
			current.map((criterion, i) =>
				i === index ? attachAssessment(criterion, assessment) : criterion,
			),
	);

	const {
		currentSubmissionIndex,
		currentSubmission,
		previousSubmission,
		nextSubmission,
	} = getSubmissionNavigation(submissions, currentSubmissionId);

	function assess(index: number, assessment: AssessmentCriterionValue) {
		const criterion = savedCriteria[index];

		if (criterion == null || isSameAssessment(criterion, assessment)) {
			return;
		}

		dispatch({ kind: "save-start", index });

		startTransition(async () => {
			addOptimisticUpdate({ index, assessment });

			const result = await saveAssessment(criterion, assessment);

			if (result.success) {
				dispatch({ kind: "save-success", index, assessment });
				return;
			}

			dispatch({ kind: "save-failure", index });
			onError(result.error);
		});
	}

	return {
		currentSubmissionIndex,
		currentSubmission,
		previousSubmission,
		nextSubmission,
		savedCriteria,
		optimisticCriteria,
		pendingByIndex,
		assess,
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
				draft.savedCriteria[action.index] = attachAssessment(
					savedCriterion,
					action.assessment,
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

function isSameAssessment(
	criterion: AssessedCriterion,
	assessment: AssessmentCriterionValue,
): boolean {
	if (
		criterion.assessment == null ||
		assessment.criterionId !== criterion.id ||
		assessment.kind !== criterion.kind
	) {
		return false;
	}

	if (criterion.kind === "check" && assessment.kind === "check") {
		return criterion.assessment.passed === assessment.passed;
	}

	if (criterion.kind === "options" && assessment.kind === "options") {
		return criterion.assessment.selectedLabel === assessment.selectedLabel;
	}

	if (criterion.kind === "number" && assessment.kind === "number") {
		return criterion.assessment.score === assessment.score;
	}

	return false;
}
