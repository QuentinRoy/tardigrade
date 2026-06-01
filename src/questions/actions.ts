"use server";

import {
	deleteQuestionDefinition,
	reorderQuestions,
	saveQuestionDefinition,
} from "#db/questionDefinitionMutations.ts";
import { toQuestionsValidationError } from "./errors.ts";
import {
	matchesDeleteConfirmation,
	parseDeletePayload,
	parseQuestionDefinitionPayload,
} from "./schemas.ts";
import { type QuestionsActionState } from "./state.ts";

export async function saveQuestionAction(
	projectId: string,
	_previousState: QuestionsActionState,
	formData: FormData,
): Promise<QuestionsActionState> {
	const payloadRaw = String(formData.get("payload") ?? "{}");

	try {
		const payload = parseQuestionDefinitionPayload(payloadRaw);
		const result = await saveQuestionDefinition(payload, projectId);

		return { status: "success", message: `Saved question ${result.id}.` };
	} catch (error) {
		const { fieldErrors, formErrors } = toQuestionsValidationError(error);
		return { status: "error", fieldErrors, formErrors };
	}
}

export async function deleteQuestionAction(
	projectId: string,
	_previousState: QuestionsActionState,
	formData: FormData,
): Promise<QuestionsActionState> {
	const payloadRaw = String(formData.get("payload") ?? "{}");

	try {
		const payload = parseDeletePayload(payloadRaw);
		const isMatch = matchesDeleteConfirmation(
			payload.confirmationText,
			payload.expectedPhrase,
		);

		if (!isMatch) {
			return {
				status: "error",
				fieldErrors: {
					confirmationText: "Confirmation phrase does not match.",
				},
			};
		}

		const { deleted } = await deleteQuestionDefinition(
			payload.questionId,
			projectId,
		);

		return {
			status: "success",
			message: deleted
				? `Deleted question ${payload.questionId}.`
				: `Question ${payload.questionId} was already removed.`,
		};
	} catch (error) {
		const { fieldErrors, formErrors } = toQuestionsValidationError(error);
		return { status: "error", fieldErrors, formErrors };
	}
}

export async function reorderQuestionsAction(
	projectId: string,
	updates: Array<{ id: string; position: number }>,
): Promise<void> {
	await reorderQuestions(updates, projectId);
}
