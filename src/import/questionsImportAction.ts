"use server";

import { toImportErrorState } from "./actionUtils.ts";
import type { ImportState } from "./importState.ts";
import { parseQuestionsYaml } from "./parseQuestions.ts";
import { saveQuestions } from "./saveQuestions.ts";

export async function questionsImportAction(
	projectId: string,
	_previousState: ImportState,
	formData: FormData,
): Promise<ImportState> {
	const questionsYaml = String(formData.get("questionsYaml") ?? "");

	try {
		const questions = parseQuestionsYaml(questionsYaml);
		const result = await saveQuestions({ questions, projectId });

		return {
			status: "success",
			message: `Imported ${result.questionCount} questions and ${result.rubricCount} rubrics. Existing records were updated in place.`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
