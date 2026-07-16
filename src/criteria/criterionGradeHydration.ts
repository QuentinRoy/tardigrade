import { assertNever } from "#utils/utils.ts";
import type { CriterionGrade, CriterionKind } from "./types.ts";

// Single kind-aware hydrator for a flat criterion-grade query row → `CriterionGrade`.
// Collapses the two copies that lived in `grading/grades.ts` and
// `results/resultsBuilder.ts` (ADR 0013). `value` accepts `string` because
// Postgres returns `numeric` columns as strings on some query paths.
export type CriterionGradeRow = {
	criterionId: string;
	kind: CriterionKind;
	passed: boolean | null;
	selectedLabel: string | null;
	value: number | string | null;
};

export function toCriterionGrade(
	row: CriterionGradeRow,
): CriterionGrade | null {
	switch (row.kind) {
		case "check":
			if (row.passed == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "check",
				passed: row.passed,
			};
		case "options":
			if (row.selectedLabel == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "options",
				selectedLabel: row.selectedLabel,
			};
		case "number":
			if (row.value == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "number",
				value:
					typeof row.value === "number"
						? row.value
						: parseFloat(String(row.value)),
			};
		default:
			return assertNever(row.kind);
	}
}
