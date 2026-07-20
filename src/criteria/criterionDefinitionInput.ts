import { assertNever } from "#utils/utils.ts";
import { toCheckCriterionDefinitionInput } from "./check/checkDomain.ts";
import { toNumberCriterionDefinitionInput } from "./number/numberDomain.ts";
import { toOptionsCriterionDefinitionInput } from "./options/optionsDomain.ts";
import type { Criterion, CriterionDefinitionInput } from "./types.ts";

// Exhaustive dispatch from a stored `Criterion` to the authored definition an
// editor edits (ADR 0013). Both sides of the mapping are kind knowledge, so each
// branch delegates to its kind folder; `rubric-management` composes this upward
// into a whole-rubric editor value.
export function toCriterionDefinitionInput(
	criterion: Criterion,
): CriterionDefinitionInput {
	switch (criterion.kind) {
		case "check":
			return toCheckCriterionDefinitionInput(criterion);
		case "options":
			return toOptionsCriterionDefinitionInput(criterion);
		case "number":
			return toNumberCriterionDefinitionInput(criterion);
		default:
			return assertNever(criterion);
	}
}
