"use server";

import { toRubricsValidationError } from "./errors.ts";
import {
	deleteRubricDefinition,
	reorderRubrics,
	saveRubricDefinition,
} from "./rubricDefinitionMutations.ts";
import {
	matchesDeleteConfirmation,
	parseDeletePayload,
	parseRubricDefinitionPayload,
} from "./schemas.ts";
import type { RubricsActionState } from "./state.ts";

export async function saveRubricAction(
	gridId: string,
	_previousState: RubricsActionState,
	formData: FormData,
): Promise<RubricsActionState> {
	const payloadRaw = String(formData.get("payload") ?? "{}");

	try {
		const payload = parseRubricDefinitionPayload(payloadRaw);
		const result = await saveRubricDefinition({ input: payload, gridId });

		return { status: "success", message: `Saved rubric ${result.id}.` };
	} catch (error) {
		const { fieldErrors, formErrors } = toRubricsValidationError(error);
		return { status: "error", fieldErrors, formErrors };
	}
}

export async function deleteRubricAction(
	gridId: string,
	_previousState: RubricsActionState,
	formData: FormData,
): Promise<RubricsActionState> {
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

		const { deleted } = await deleteRubricDefinition({
			rubricId: payload.rubricId,
			gridId,
		});

		return {
			status: "success",
			message: deleted
				? `Deleted rubric ${payload.rubricId}.`
				: `Rubric ${payload.rubricId} was already removed.`,
		};
	} catch (error) {
		const { fieldErrors, formErrors } = toRubricsValidationError(error);
		return { status: "error", fieldErrors, formErrors };
	}
}

export async function reorderRubricsAction(
	gridId: string,
	updates: Array<{ id: string; position: number }>,
): Promise<void> {
	await reorderRubrics({ updates, gridId });
}
