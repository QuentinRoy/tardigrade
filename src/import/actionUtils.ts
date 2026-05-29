import { prettifyError, ZodError } from "zod";
import type { ImportState } from "./importState";

export function toImportErrorState(error: unknown): ImportState {
	if (error instanceof ZodError) {
		return { status: "error", errors: [prettifyError(error)] };
	}

	if (error instanceof Error) {
		return { status: "error", errors: [error.message] };
	}

	return { status: "error", errors: ["Unknown import error"] };
}
