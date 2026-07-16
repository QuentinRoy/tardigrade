import type { Simplify } from "#utils/utils.ts";
import type { CheckCriterionEditorValue } from "./checkSchemas.ts";

// Canonical config and grade-content shapes for the Check criterion kind. The
// generic `Criterion`/`CriterionGrade` unions in ../types.ts assemble their
// `check` members from these, so this folder is the single owner of what a Check
// criterion is (ADR 0013).

type CheckCriterionBase = {
	id: string;
	description?: string | undefined;
	label?: string | undefined;
};

export type CheckCriterion = Simplify<
	CheckCriterionBase & { kind: "check"; marks: number; falseMarks: number }
>;

export type CheckCriterionGrade = {
	criterionId: string;
	kind: "check";
	passed: boolean;
};

export type CheckCriterionGradeContent = { passed: boolean };

// Default value the authoring UI seeds a new Check criterion with. Lives here
// (not in checkSchemas.ts) so client editors importing it don't pull zod into
// the browser bundle; the return type is still the schema output, imported
// type-only.
export function createCheckCriterion(): CheckCriterionEditorValue {
	return {
		id: "",
		kind: "check",
		label: "",
		description: "",
		marks: 1,
		falseMarks: 0,
	};
}

export function markCheckCriterion(
	criterion: CheckCriterion,
	passed: boolean,
): number {
	return passed ? criterion.marks : criterion.falseMarks;
}

export function getCheckCriterionMaxMarks(criterion: CheckCriterion): number {
	return Math.max(criterion.marks, criterion.falseMarks);
}

export function getCheckCriterionMinMarks(criterion: CheckCriterion): number {
	return Math.min(criterion.marks, criterion.falseMarks);
}

// Neutral display facts for the results/details projection (consumed by
// getCriterionDetails' exhaustive dispatch). Returns facts, not JSX.
export type CheckPropertyDetails = {
	kind: "check";
	trueMarks: number;
	falseMarks: number;
};

export function describeCheck(criterion: CheckCriterion): CheckPropertyDetails {
	return {
		kind: "check",
		trueMarks: criterion.marks,
		falseMarks: criterion.falseMarks,
	};
}

// CSV grade-value projection: the kind-specific cell value the export column
// carries for a graded Check criterion (the column shape stays owned by
// `export`).
export function exportCheckGradeValue(
	grade: CheckCriterionGradeContent,
): boolean {
	return grade.passed;
}

// YAML-encode projection: the serializable object written for a Check criterion
// (ADR 0013 — the kind owns both decode and encode of the YAML contract).
// Optional text fields are omitted when absent, matching js-yaml's handling of
// `undefined`.
export function encodeCheckCriterion(criterion: CheckCriterion): {
	id: string;
	kind: "check";
	marks: number;
	falseMarks: number;
	label?: string;
	description?: string;
} {
	return {
		id: criterion.id,
		kind: criterion.kind,
		marks: criterion.marks,
		falseMarks: criterion.falseMarks,
		...(criterion.label != null ? { label: criterion.label } : {}),
		...(criterion.description != null
			? { description: criterion.description }
			: {}),
	};
}
