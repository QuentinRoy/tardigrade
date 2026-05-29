"use server";

import {
	deleteManagedQuestion,
	reorderQuestions,
	saveManagedQuestion,
} from "@/db/questions";
import { toQuestionsValidationError } from "./errors";
import {
	matchesDeleteConfirmation,
	parseDeletePayload,
	parseManagedQuestionPayload,
} from "./schemas";
import { type QuestionsActionState } from "./state";

export async function saveQuestionAction(
	projectId: string,
	_previousState: QuestionsActionState,
	formData: FormData,
): Promise<QuestionsActionState> {
	const payloadRaw = String(formData.get("payload") ?? "{}");

	try {
		const payload = parseManagedQuestionPayload(payloadRaw);
		const result = await saveManagedQuestion(payload, projectId);

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

		const result = await deleteManagedQuestion(payload.questionId, projectId);

		return {
			status: "success",
			message: `Deleted question ${payload.questionId} and ${result.assessmentCount} related assessments.`,
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
