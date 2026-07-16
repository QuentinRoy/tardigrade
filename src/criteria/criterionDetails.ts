import {
	type CheckPropertyDetails,
	describeCheck,
} from "./check/checkDomain.ts";
import type { Criterion, CriterionKind } from "./types.ts";

// Neutral, kind-uniform display facts for a criterion (ADR 0013). `results`
// consumes this projection instead of reading criterion storage props directly;
// the projection returns facts, not JSX, so tooltip layout stays in `results`.

type CriterionPropertyDetails =
	| CheckPropertyDetails
	| { kind: "options"; marksByLabel: Array<{ label: string; marks: number }> }
	| {
			kind: "number";
			minValue: number;
			maxValue: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

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
				properties: {
					kind: "options",
					marksByLabel: Object.entries(criterion.marks).map(
						([label, marks]) => ({ label, marks }),
					),
				},
			};
		case "number":
			return {
				label: criterion.label,
				description: criterion.description,
				kind: criterion.kind,
				properties: {
					kind: "number",
					minValue: criterion.minValue,
					maxValue: criterion.maxValue,
					minMarks: criterion.minMarks,
					maxMarks: criterion.maxMarks,
					reversed: criterion.reversed,
				},
			};
	}
}
