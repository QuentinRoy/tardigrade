import { ZodError } from "zod";

export type QuestionRubricFieldErrors = {
	id?: string | undefined;
	label?: string | undefined;
	description?: string | undefined;
	type?: string | undefined;
	marks?: string | undefined;
	falseMarks?: string | undefined;
	minScore?: string | undefined;
	maxScore?: string | undefined;
	minMarks?: string | undefined;
	maxMarks?: string | undefined;
	reversed?: string | undefined;
};

export type QuestionsFieldErrors = {
	questionId?: string | undefined;
	confirmationText?: string | undefined;
	rubrics?: QuestionRubricFieldErrors[] | undefined;
};

export class QuestionsValidationError extends Error {
	fieldErrors: QuestionsFieldErrors;
	formErrors: string[];

	constructor({
		fieldErrors = {},
		formErrors = [],
	}: { fieldErrors?: QuestionsFieldErrors; formErrors?: string[] }) {
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
	rubrics[index] = { ...current, [field]: message };
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
				// We trust that the Zod schema paths are correct, so we can safely
				// cast third to a keyof QuestionRubricFieldErrors without additional checks.
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
		return { fieldErrors: error.fieldErrors, formErrors: error.formErrors };
	}

	if (error instanceof ZodError) {
		return zodErrorToQuestionsValidationError(error);
	}

	if (error instanceof Error) {
		return { fieldErrors: {}, formErrors: [error.message] };
	}

	return { fieldErrors: {}, formErrors: ["Unknown question validation error"] };
}
