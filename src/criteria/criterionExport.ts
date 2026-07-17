import { assertNever } from "#utils/utils.ts";
import { exportCheckGradeValue } from "./check/checkDomain.ts";
import { exportNumberGradeValue } from "./number/numberDomain.ts";
import type { GradedCriterion } from "./types.ts";

// The kind-specific CSV grade-value projection (ADR 0013). The kind-uniform CSV
// column shape stays owned by `export`; only the per-criterion cell value is
// kind knowledge and dispatches here.
export type CriterionExportGradeValue = string | number | boolean;

export function getCriterionExportGradeValue(
	criterion: GradedCriterion,
): CriterionExportGradeValue | undefined {
	if (criterion.grade == null) {
		return undefined;
	}

	switch (criterion.kind) {
		case "check":
			return exportCheckGradeValue(criterion.grade);
		case "options":
			return criterion.grade.selectedLabel;
		case "number":
			return exportNumberGradeValue(criterion.grade);
		default:
			return assertNever(criterion);
	}
}
