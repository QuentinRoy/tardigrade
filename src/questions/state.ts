import type { ImportState } from "@/import/importState";
import type { QuestionsFieldErrors } from "./errors";

export type QuestionsActionState = Omit<ImportState, "errors"> & {
	fieldErrors?: QuestionsFieldErrors;
	formErrors?: string[];
};

export const initialQuestionsActionState: QuestionsActionState = {
	status: "idle",
};
