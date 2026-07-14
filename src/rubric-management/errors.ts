import { ZodError } from "zod";
import { createLogger } from "#utils/logger.ts";

const logger = createLogger("rubrics");

export const rubricsMessages = {
	unexpected:
		"Something went wrong saving this rubric. Reload and try again. If this keeps happening, report this issue.",
};

export type RubricCriterionFieldErrors = {
	id?: string | undefined;
	label?: string | undefined;
	description?: string | undefined;
	type?: string | undefined;
	marks?: string | undefined;
	falseMarks?: string | undefined;
	minValue?: string | undefined;
	maxValue?: string | undefined;
	minMarks?: string | undefined;
	maxMarks?: string | undefined;
	reversed?: string | undefined;
};

export type RubricsFieldErrors = {
	rubricId?: string | undefined;
	confirmationText?: string | undefined;
	criteria?: RubricCriterionFieldErrors[] | undefined;
};

export class RubricsValidationError extends Error {
	fieldErrors: RubricsFieldErrors;
	formErrors: string[];

	constructor({
		fieldErrors = {},
		formErrors = [],
	}: { fieldErrors?: RubricsFieldErrors; formErrors?: string[] }) {
		super("Validation failed");
		this.name = "RubricsValidationError";
		this.fieldErrors = fieldErrors;
		this.formErrors = formErrors;
	}
}

function setCriterionFieldError(
	fieldErrors: RubricsFieldErrors,
	index: number,
	field: keyof RubricCriterionFieldErrors,
	message: string,
): void {
	const criteria = fieldErrors.criteria ?? [];
	const current = criteria[index] ?? {};
	criteria[index] = { ...current, [field]: message };
	fieldErrors.criteria = criteria;
}

export function zodErrorToRubricsValidationError(error: ZodError): {
	fieldErrors: RubricsFieldErrors;
	formErrors: string[];
} {
	const fieldErrors: RubricsFieldErrors = {};
	const formErrors: string[] = [];

	for (const issue of error.issues) {
		const [first, second, third] = issue.path;

		if (first === "id" || first === "originalId") {
			fieldErrors.rubricId = issue.message;
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
				// cast third to a keyof RubricCriterionFieldErrors without additional checks.
				// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
				third as keyof RubricCriterionFieldErrors,
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

export function toRubricsValidationError(error: unknown): {
	fieldErrors: RubricsFieldErrors;
	formErrors: string[];
} {
	if (error instanceof RubricsValidationError) {
		return { fieldErrors: error.fieldErrors, formErrors: error.formErrors };
	}

	if (error instanceof ZodError) {
		return zodErrorToRubricsValidationError(error);
	}

	logger.error({ err: error }, "Unexpected error during rubric save");
	return { fieldErrors: {}, formErrors: [rubricsMessages.unexpected] };
}
