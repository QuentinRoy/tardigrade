import { prettifyError, ZodError } from "zod";
import { createLogger } from "#utils/logger.ts";
import { ImportBlockedError } from "./importErrors.ts";
import type { ImportState } from "./importState.ts";

const logger = createLogger("import");

export const importMessages = {
	unexpected:
		"Something went wrong during the import. Nothing was imported. Reload and try again. If this keeps happening, report this issue.",
};

export function toImportErrorState(error: unknown): ImportState {
	if (error instanceof ZodError) {
		return { status: "error", errors: [prettifyError(error)] };
	}

	if (error instanceof ImportBlockedError) {
		return { status: "error", errors: [error.message] };
	}

	logger.error({ err: error }, "Unexpected error during import");
	return { status: "error", errors: [importMessages.unexpected] };
}
