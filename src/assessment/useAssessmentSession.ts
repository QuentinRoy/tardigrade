"use client";

import { produce } from "immer";
import { startTransition, useOptimistic, useReducer } from "react";
import type { AssessmentRubricValue, Submission } from "../db/types";
import { type AssessedRubric, attachAssessment } from "../rubrics/rubric";
import { getSubmissionNavigation } from "./submissionNavigation";

export type SaveRubricResult<TError> =
	| { success: true }
	| { success: false; error: TError };

export type UseAssessmentSessionConfig<TError> = {
	initialRubrics: AssessedRubric[];
	submissions: Submission[];
	currentSubmissionId: string;
	saveRubric: (
		rubric: AssessedRubric,
		assessment: AssessmentRubricValue,
	) => Promise<SaveRubricResult<TError>>;
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
	saveRubric,
	onError,
}: UseAssessmentSessionConfig<TError>): UseAssessmentSessionResult {
	const [{ savedRubrics, pendingByIndex }, dispatch] = useReducer(reducer, {
		savedRubrics: initialRubrics,
		pendingByIndex: {},
	});

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

			const result = await saveRubric(rubric, assessment);

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
	right: AssessmentRubricValue,
): boolean {
	if (
		rubric.assessment == null ||
		right.rubricId !== rubric.id ||
		right.type !== rubric.type
	) {
		return false;
	}

	if (right.type === "boolean") {
		const assessment =
			rubric.assessment as AssessedRubric<"boolean">["assessment"];
		return assessment?.passed === right.passed;
	}

	if (right.type === "ordinal") {
		const assessment =
			rubric.assessment as AssessedRubric<"ordinal">["assessment"];
		return assessment?.selectedLabel === right.selectedLabel;
	}

	const assessment =
		rubric.assessment as AssessedRubric<"numerical">["assessment"];
	return assessment?.score === right.score;
}
