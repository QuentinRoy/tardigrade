import {
	type CheckPropertyDetails,
	describeCheck,
} from "./check/checkDomain.ts";
import {
	describeNumber,
	type NumberPropertyDetails,
} from "./number/numberDomain.ts";
import {
	describeOptions,
	type OptionsPropertyDetails,
} from "./options/optionsDomain.ts";
import type { Criterion, CriterionKind } from "./types.ts";

// Neutral, kind-uniform display facts for a criterion (ADR 0013). `results`
// consumes this projection instead of reading criterion storage props directly;
// the projection returns facts, not JSX, so tooltip layout stays in `results`.

type CriterionPropertyDetails =
	| CheckPropertyDetails
	| OptionsPropertyDetails
	| NumberPropertyDetails;

export type CriterionDetails = {
	label?: string | undefined;
	description?: string | undefined;
	kind: CriterionKind;
	properties: CriterionPropertyDetails;
};

export function getCriterionDetails(criterion: Criterion): CriterionDetails {
	switch (criterion.kind) {
		case "check":
			return {
				label: criterion.label,
				description: criterion.description,
				kind: criterion.kind,
				properties: describeCheck(criterion),
			};
		case "options":
			return {
				label: criterion.label,
				description: criterion.description,
				kind: criterion.kind,
				properties: describeOptions(criterion),
			};
		case "number":
			return {
				label: criterion.label,
				description: criterion.description,
				kind: criterion.kind,
				properties: describeNumber(criterion),
			};
	}
}
