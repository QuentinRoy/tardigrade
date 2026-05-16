import { ZodError } from "zod";

export type QuestionRubricFieldErrors = {
  id?: string;
  label?: string;
  description?: string;
  type?: string;
  marks?: string;
  falseMarks?: string;
  minScore?: string;
  maxScore?: string;
  minMarks?: string;
  maxMarks?: string;
  reversed?: string;
};

export type QuestionsFieldErrors = {
  questionId?: string;
  confirmationText?: string;
  rubrics?: QuestionRubricFieldErrors[];
};

export class QuestionsValidationError extends Error {
  fieldErrors: QuestionsFieldErrors;
  formErrors: string[];

  constructor({
    fieldErrors = {},
    formErrors = [],
  }: {
    fieldErrors?: QuestionsFieldErrors;
    formErrors?: string[];
  }) {
    super("Validation failed");
    this.name = "QuestionsValidationError";
    this.fieldErrors = fieldErrors;
    this.formErrors = formErrors;
  }
}

function setRubricFieldError(
  fieldErrors: QuestionsFieldErrors,
  index: number,
  field: keyof QuestionRubricFieldErrors,
  message: string,
): void {
  const rubrics = fieldErrors.rubrics ?? [];
  const current = rubrics[index] ?? {};
  rubrics[index] = {
    ...current,
    [field]: message,
  };
  fieldErrors.rubrics = rubrics;
}

export function zodErrorToQuestionsValidationError(error: ZodError): {
  fieldErrors: QuestionsFieldErrors;
  formErrors: string[];
} {
  const fieldErrors: QuestionsFieldErrors = {};
  const formErrors: string[] = [];

  for (const issue of error.issues) {
    const [first, second, third] = issue.path;

    if (first === "id" || first === "originalId") {
      fieldErrors.questionId = issue.message;
      continue;
    }

    if (first === "confirmationText") {
      fieldErrors.confirmationText = issue.message;
      continue;
    }

    if (
      first === "rubrics" &&
      typeof second === "number" &&
      typeof third === "string"
    ) {
      setRubricFieldError(
        fieldErrors,
        second,
        third as keyof QuestionRubricFieldErrors,
        issue.message,
      );
      continue;
    }

    if (first === "rubrics" && typeof second === "number") {
      setRubricFieldError(fieldErrors, second, "id", issue.message);
      continue;
    }

    formErrors.push(issue.message);
  }

  return { fieldErrors, formErrors };
}

export function toQuestionsValidationError(error: unknown): {
  fieldErrors: QuestionsFieldErrors;
  formErrors: string[];
} {
  if (error instanceof QuestionsValidationError) {
    return {
      fieldErrors: error.fieldErrors,
      formErrors: error.formErrors,
    };
  }

  if (error instanceof ZodError) {
    return zodErrorToQuestionsValidationError(error);
  }

  if (error instanceof Error) {
    return {
      fieldErrors: {},
      formErrors: [error.message],
    };
  }

  return {
    fieldErrors: {},
    formErrors: ["Unknown question validation error"],
  };
}
