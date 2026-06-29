import type { ActionState } from "#utils/actionState.ts";
import type { QuestionsFieldErrors } from "./errors.ts";

export type QuestionsActionState = Omit<ActionState, "errors"> & {
	fieldErrors?: QuestionsFieldErrors;
	formErrors?: string[];
};

export const initialQuestionsActionState: QuestionsActionState = {
	status: "idle",
};
