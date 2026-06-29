import { prettifyError, ZodError } from "zod";
import type { ActionState } from "#utils/actionState.ts";
import { createLogger } from "#utils/logger.ts";
import { ImportBlockedError } from "./importErrors.ts";

const logger = createLogger("import");

export const importMessages = {
	unexpected:
		"Something went wrong during the import. Nothing was imported. Reload and try again. If this keeps happening, report this issue.",
};

export function toImportErrorState(error: unknown): ActionState {
	if (error instanceof ZodError) {
		return { status: "error", errors: [prettifyError(error)] };
	}

	if (error instanceof ImportBlockedError) {
		return { status: "error", errors: [error.message] };
	}

	logger.error({ err: error }, "Unexpected error during import");
	return { status: "error", errors: [importMessages.unexpected] };
}
