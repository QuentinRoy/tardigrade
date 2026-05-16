"use server";

import { redirect } from "next/navigation";
import {
  deleteManagedQuestion,
  getQuestionDeleteImpact,
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
  _previousState: QuestionsActionState,
  formData: FormData,
): Promise<QuestionsActionState> {
  const payloadRaw = String(formData.get("payload") ?? "{}");

  try {
    const payload = parseManagedQuestionPayload(payloadRaw);
    const result = await saveManagedQuestion(payload);

    return {
      status: "success",
      message: `Saved question ${result.id}.`,
    };
  } catch (error) {
    const { fieldErrors, formErrors } = toQuestionsValidationError(error);
    return {
      status: "error",
      fieldErrors,
      formErrors,
    };
  }
}

export async function editQuestionAction(
  _previousState: QuestionsActionState,
  formData: FormData,
): Promise<QuestionsActionState> {
  const payloadRaw = String(formData.get("payload") ?? "{}");

  try {
    const payload = parseManagedQuestionPayload(payloadRaw);
    await saveManagedQuestion(payload);
  } catch (error) {
    const { fieldErrors, formErrors } = toQuestionsValidationError(error);
    return {
      status: "error",
      fieldErrors,
      formErrors,
    };
  }

  redirect("/questions");
}

export async function getDeleteImpactAction(questionId: string): Promise<{
  assessmentCount: number;
}> {
  return getQuestionDeleteImpact(questionId);
}

export async function deleteQuestionAction(
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

    const result = await deleteManagedQuestion(payload.questionId);

    return {
      status: "success",
      message: `Deleted question ${payload.questionId} and ${result.assessmentCount} related assessments.`,
    };
  } catch (error) {
    const { fieldErrors, formErrors } = toQuestionsValidationError(error);
    return {
      status: "error",
      fieldErrors,
      formErrors,
    };
  }
}
