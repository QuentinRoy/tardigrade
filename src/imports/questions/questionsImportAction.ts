"use server";

import { toImportErrorState } from "#imports/actionUtils.ts";
import type { ActionState } from "#utils/actionState.ts";
import { parseQuestionsYaml } from "./parseQuestions.ts";
import { saveQuestions } from "./saveQuestions.ts";

export async function questionsImportAction(
	projectId: string,
	_previousState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const questionsYaml = String(formData.get("questionsYaml") ?? "");

	try {
		const questions = parseQuestionsYaml(questionsYaml);
		const result = await saveQuestions({ questions, projectId });

		const typeChangeNote =
			result.typeChangedRubricCount > 0
				? ` ${result.typeChangedRubricCount} rubric type(s) were changed.`
				: "";

		return {
			status: "success",
			message: `Imported ${result.questionCount} questions and ${result.rubricCount} rubrics. Existing records were updated in place.${typeChangeNote}`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
