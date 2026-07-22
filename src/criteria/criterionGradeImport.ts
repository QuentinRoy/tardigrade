import { assertNever } from "#utils/utils.ts";
import { parseCheckGradeValue } from "./check/checkDomain.ts";
import {
	getNumberGradeBoundsError,
	parseNumberGradeValue,
} from "./number/numberDomain.ts";
import { parseOptionsGradeValue } from "./options/optionsDomain.ts";
import type { CriterionGrade, CriterionKind } from "./types.ts";

// The kind-specific grades-CSV cell parse (ADR 0013), read mirror of
// getCriterionExportGradeValue. `imports` owns the CSV row and column shape;
// only the per-criterion cell value is kind knowledge and dispatches here.

// What parsing a cell needs to know about the criterion it belongs to.
type ImportedGradeCriterionBase = {
	id: string;
	// Labels the criterion offers; only meaningful for the Options kind.
	optionsLabels: string[];
};

export type ImportedGradeCriterion = ImportedGradeCriterionBase &
	(
		| { kind: Exclude<CriterionKind, "number"> }
		| { kind: "number"; minValue: number; maxValue: number }
	);

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
		case "number": {
			const grade = parseNumberGradeValue(value);
			const boundsError = getNumberGradeBoundsError({
				...grade,
				minValue: criterion.minValue,
				maxValue: criterion.maxValue,
			});
			if (boundsError != null) {
				throw new Error(boundsError);
			}

			return { criterionId: criterion.id, kind: "number", ...grade };
		}
		default:
			return assertNever(criterion);
	}
}
