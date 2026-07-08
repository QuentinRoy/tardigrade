import { ZodError } from "zod";
import { createLogger } from "#utils/logger.ts";

const logger = createLogger("questions");

export const questionsMessages = {
	unexpected:
		"Something went wrong saving this question. Reload and try again. If this keeps happening, report this issue.",
};

export type QuestionCriterionFieldErrors = {
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
	criteria?: QuestionCriterionFieldErrors[] | undefined;
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

function setCriterionFieldError(
	fieldErrors: QuestionsFieldErrors,
	index: number,
	field: keyof QuestionCriterionFieldErrors,
	message: string,
): void {
	const criteria = fieldErrors.criteria ?? [];
	const current = criteria[index] ?? {};
	criteria[index] = { ...current, [field]: message };
	fieldErrors.criteria = criteria;
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
			first === "criteria" &&
			typeof second === "number" &&
			typeof third === "string"
		) {
			setCriterionFieldError(
				fieldErrors,
				second,
				// We trust that the Zod schema paths are correct, so we can safely
				// cast third to a keyof QuestionCriterionFieldErrors without additional checks.
				// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
				third as keyof QuestionCriterionFieldErrors,
				issue.message,
			);
			continue;
		}

		if (first === "criteria" && typeof second === "number") {
			setCriterionFieldError(fieldErrors, second, "id", issue.message);
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

	logger.error({ err: error }, "Unexpected error during question save");
	return { fieldErrors: {}, formErrors: [questionsMessages.unexpected] };
}
