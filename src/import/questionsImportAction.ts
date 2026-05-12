"use server";

import { revalidateTag } from "next/cache";
import { toImportErrorState } from "./actionUtils";
import type { ImportState } from "./importState";
import { parseQuestionsYaml } from "./parseQuestions";
import { saveQuestions } from "./saveQuestions";

export async function questionsImportAction(
  _previousState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const questionsYaml = String(formData.get("questionsYaml") ?? "");

  try {
    const questions = parseQuestionsYaml(questionsYaml);
    const result = await saveQuestions(questions);

    revalidateTag("questions", "max");
    revalidateTag("assessments", "max");

    return {
      status: "success",
      message: `Imported ${result.questionCount} questions and ${result.rubricCount} rubrics. Existing records were updated in place.`,
    };
  } catch (error) {
    return toImportErrorState(error);
  }
}
