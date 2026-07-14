import { createLogger } from "#utils/logger.ts";

const logger = createLogger("grids");

export const gridMessages = {
	unexpected:
		"Could not create the grid. Reload the page and try again. If this keeps happening, report this issue.",
};

export function toCreateGridErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message === "Grid name is required.") {
		return "Grid name is required. Enter a name and try again.";
	}

	logger.error({ err: error }, "Unexpected error creating a grid");
	return gridMessages.unexpected;
}
