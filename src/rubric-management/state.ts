import type { ActionState } from "#utils/actionState.ts";
import type { RubricsFieldErrors } from "./errors.ts";

export type RubricsActionState = Omit<ActionState, "errors"> & {
	fieldErrors?: RubricsFieldErrors;
	formErrors?: string[];
};

export const initialRubricsActionState: RubricsActionState = { status: "idle" };
