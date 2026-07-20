import { assertNever } from "#utils/utils.ts";
import { parseCheckGradeValue } from "./check/checkDomain.ts";
import { parseNumberGradeValue } from "./number/numberDomain.ts";
import { parseOptionsGradeValue } from "./options/optionsDomain.ts";
import type { CriterionGrade, CriterionKind } from "./types.ts";

// The kind-specific grades-CSV cell parse (ADR 0013), read mirror of
// getCriterionExportGradeValue. `imports` owns the CSV row and column shape;
// only the per-criterion cell value is kind knowledge and dispatches here.

// What parsing a cell needs to know about the criterion it belongs to.
export type ImportedGradeCriterion = {
	id: string;
	kind: CriterionKind;
	// Labels the criterion offers; only meaningful for the Options kind.
	optionsLabels: string[];
};

// Throws when the cell does not parse for the criterion's kind; `imports`
// catches that and reports it as a row diagnostic.
export function parseCriterionGradeValue(params: {
	value: string;
	criterion: ImportedGradeCriterion;
}): CriterionGrade {
	const { value, criterion } = params;

	switch (criterion.kind) {
		case "check":
			return {
				criterionId: criterion.id,
				kind: "check",
				...parseCheckGradeValue(value),
			};
		case "options":
			return {
				criterionId: criterion.id,
				kind: "options",
				...parseOptionsGradeValue(value, {
					id: criterion.id,
					labels: criterion.optionsLabels,
				}),
			};
		case "number":
			return {
				criterionId: criterion.id,
				kind: "number",
				...parseNumberGradeValue(value),
			};
		default:
			return assertNever(criterion.kind);
	}
}
