import { createLogger } from "#utils/logger.ts";

const logger = createLogger("projects");

export const projectMessages = {
	unexpected:
		"Could not create the project. Reload the page and try again. If this keeps happening, report this issue.",
};

export function toCreateProjectErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message === "Project name is required.") {
		return "Project name is required. Enter a name and try again.";
	}

	logger.error({ err: error }, "Unexpected error creating a project");
	return projectMessages.unexpected;
}
