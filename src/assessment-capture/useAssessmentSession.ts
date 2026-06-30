"use client";

import { produce } from "immer";
import { startTransition, useOptimistic, useReducer } from "react";
import { attachAssessment } from "#rubrics/rubric.ts";
import type { AssessedRubric, AssessmentRubricValue } from "#rubrics/types.ts";
import type { Submission } from "#submissions/types.ts";
import { useBeforeUnloadGuard } from "#utils/useBeforeUnloadGuard.ts";
import { getSubmissionNavigation } from "./submissionNavigation.ts";

export type SaveResult<TError> =
	| { success: true }
	| { success: false; error: TError };

export type UseAssessmentSessionConfig<TError> = {
	initialRubrics: AssessedRubric[];
	submissions: Submission[];
	currentSubmissionId: string;
	saveAssessment: (
		rubric: AssessedRubric,
		assessment: AssessmentRubricValue,
	) => Promise<SaveResult<TError>>;
	onError: (error: TError) => void;
};

export type UseAssessmentSessionResult = {
	currentSubmissionIndex: number;
	currentSubmission: Submission | undefined;
	previousSubmission: Submission | undefined;
	nextSubmission: Submission | undefined;
	savedRubrics: AssessedRubric[];
	optimisticRubrics: AssessedRubric[];
	pendingByIndex: Record<number, number>;
	assess: (index: number, assessment: AssessmentRubricValue) => void;
};

type State = {
	savedRubrics: AssessedRubric[];
	pendingByIndex: Record<number, number>;
};

type Action =
	| { type: "save-start"; index: number }
	| { type: "save-success"; index: number; assessment: AssessmentRubricValue }
	| { type: "save-failure"; index: number };

export function useAssessmentSession<TError>({
	initialRubrics,
	submissions,
	currentSubmissionId,
	saveAssessment,
	onError,
}: UseAssessmentSessionConfig<TError>): UseAssessmentSessionResult {
	const [{ savedRubrics, pendingByIndex }, dispatch] = useReducer(reducer, {
		savedRubrics: initialRubrics,
		pendingByIndex: {},
	});

	const pendingCount = Object.values(pendingByIndex).reduce(
		(total, count) => total + count,
		0,
	);
	useBeforeUnloadGuard(pendingCount > 0);

	const [optimisticRubrics, addOptimisticUpdate] = useOptimistic(
		savedRubrics,
		(
			current,
			{
				index,
				assessment,
			}: { index: number; assessment: AssessmentRubricValue },
		) =>
			current.map((rubric, i) =>
				i === index ? attachAssessment(rubric, assessment) : rubric,
			),
	);

	const {
		currentSubmissionIndex,
		currentSubmission,
		previousSubmission,
		nextSubmission,
	} = getSubmissionNavigation(submissions, currentSubmissionId);

	function assess(index: number, assessment: AssessmentRubricValue) {
		const rubric = savedRubrics[index];

		if (rubric == null || isSameAssessment(rubric, assessment)) {
			return;
		}

		dispatch({ type: "save-start", index });

		startTransition(async () => {
			addOptimisticUpdate({ index, assessment });

			const result = await saveAssessment(rubric, assessment);

			if (result.success) {
				dispatch({ type: "save-success", index, assessment });
				return;
			}

			dispatch({ type: "save-failure", index });
			onError(result.error);
		});
	}

	return {
		currentSubmissionIndex,
		currentSubmission,
		previousSubmission,
		nextSubmission,
		savedRubrics,
		optimisticRubrics,
		pendingByIndex,
		assess,
	};
}

function reducer(state: State, action: Action): State {
	return produce(state, (draft) => {
		switch (action.type) {
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
				const savedRubric = draft.savedRubrics[action.index];
				if (savedRubric == null) {
					break;
				}
				draft.savedRubrics[action.index] = attachAssessment(
					savedRubric,
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
	rubric: AssessedRubric,
	assessment: AssessmentRubricValue,
): boolean {
	if (
		rubric.assessment == null ||
		assessment.rubricId !== rubric.id ||
		assessment.type !== rubric.type
	) {
		return false;
	}

	if (rubric.type === "boolean" && assessment.type === "boolean") {
		return rubric.assessment.passed === assessment.passed;
	}

	if (rubric.type === "ordinal" && assessment.type === "ordinal") {
		return rubric.assessment.selectedLabel === assessment.selectedLabel;
	}

	if (rubric.type === "numerical" && assessment.type === "numerical") {
		return rubric.assessment.score === assessment.score;
	}

	return false;
}
