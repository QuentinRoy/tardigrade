import type { Simplify } from "#utils/utils.ts";
import type { NumberCriterionDefinitionInput } from "./numberSchemas.ts";

// Canonical config and grade-content shapes for the Number criterion kind. The
// generic `Criterion`/`CriterionGrade` unions in ../types.ts assemble their
// `number` members from these, so this folder is the single owner of what a
// Number criterion is (ADR 0013).

type NumberCriterionBase = {
	id: string;
	description?: string | undefined;
	label?: string | undefined;
};

export type NumberCriterion = Simplify<
	NumberCriterionBase & {
		kind: "number";
		minValue: number;
		maxValue: number;
		minMarks: number;
		maxMarks: number;
		reversed: boolean;
	}
>;

export type NumberCriterionGrade = {
	criterionId: string;
	kind: "number";
	value: number;
};

export type NumberCriterionGradeContent = { value: number };

// Default value the authoring UI seeds a new Number criterion with. Lives here
// (not in numberSchemas.ts) so client editors importing it don't pull zod into
// the browser bundle; the return type is still the schema output, imported
// type-only.
export function createNumberCriterion(): NumberCriterionDefinitionInput {
	return {
		id: "",
		kind: "number",
		label: "",
		description: "",
		minValue: 0,
		maxValue: 1,
		minMarks: 0,
		maxMarks: 1,
		reversed: false,
	};
}

// Editor-value projection: the authored definition the management UI edits for
// an existing Number criterion (`previousId` carries the id the criterion is
// stored under, so a renamed id can be matched back on save).
export function toNumberCriterionDefinitionInput(
	criterion: NumberCriterion,
): NumberCriterionDefinitionInput {
	return {
		previousId: criterion.id,
		id: criterion.id,
		description: criterion.description,
		label: criterion.label,
		kind: "number",
		minValue: criterion.minValue,
		maxValue: criterion.maxValue,
		minMarks: criterion.minMarks,
		maxMarks: criterion.maxMarks,
		reversed: criterion.reversed,
	};
}

export function markNumberCriterion(
	criterion: NumberCriterion & { grade: NumberCriterionGradeContent },
): number {
	const valueRange = criterion.maxValue - criterion.minValue;
	if (valueRange === 0) {
		throw new Error(
			`Cannot mark a number criterion with a zero-width value range (minValue and maxValue are both ${criterion.minValue})`,
		);
	}

	const { value } = criterion.grade;
	const valueOffset = criterion.reversed
		? criterion.maxValue - value
		: value - criterion.minValue;

	return (
		criterion.minMarks +
		(valueOffset * (criterion.maxMarks - criterion.minMarks)) / valueRange
	);
}

export function getNumberCriterionMaxMarks(criterion: NumberCriterion): number {
	return criterion.maxMarks;
}

export function getNumberCriterionMinMarks(criterion: NumberCriterion): number {
	return criterion.minMarks;
}

// Neutral display facts for the results/details projection (consumed by
// getCriterionDetails' exhaustive dispatch). Returns facts, not JSX.
export type NumberPropertyDetails = {
	kind: "number";
	minValue: number;
	maxValue: number;
	minMarks: number;
	maxMarks: number;
	reversed: boolean;
};

export function describeNumber(
	criterion: NumberCriterion,
): NumberPropertyDetails {
	return {
		kind: "number",
		minValue: criterion.minValue,
		maxValue: criterion.maxValue,
		minMarks: criterion.minMarks,
		maxMarks: criterion.maxMarks,
		reversed: criterion.reversed,
	};
}

// CSV grade-value projection: the kind-specific cell value the export column
// carries for a graded Number criterion (the column shape stays owned by
// `export`).
export function exportNumberGradeValue(
	grade: NumberCriterionGradeContent,
): number {
	return grade.value;
}

// CSV grade-value parse: the read mirror of exportNumberGradeValue, turning an
// imported cell into Number grade content. Throws when the cell is not a number;
// `imports` turns that into a row diagnostic.
export function parseNumberGradeValue(
	value: string,
): NumberCriterionGradeContent {
	const criterionValue = parseFloat(value);
	if (Number.isNaN(criterionValue)) {
		throw new Error(`Invalid number value "${value}"`);
	}

	return { value: criterionValue };
}

// Whether two Number grades hold the same value (used to skip no-op saves).
export function isSameNumberGrade(
	grade: NumberCriterionGradeContent,
	other: NumberCriterionGradeContent,
): boolean {
	return grade.value === other.value;
}

// YAML-encode projection: the serializable object written for a Number criterion
// (ADR 0013 — the kind owns both decode and encode of the YAML contract).
// Optional text fields are omitted when absent, matching js-yaml's handling of
// `undefined`.
export function encodeNumberCriterion(criterion: NumberCriterion): {
	id: string;
	kind: "number";
	minValue: number;
	maxValue: number;
	minMarks: number;
	maxMarks: number;
	reversed: boolean;
	label?: string;
	description?: string;
} {
	return {
		id: criterion.id,
		kind: criterion.kind,
		minValue: criterion.minValue,
		maxValue: criterion.maxValue,
		minMarks: criterion.minMarks,
		maxMarks: criterion.maxMarks,
		reversed: criterion.reversed,
		...(criterion.label != null ? { label: criterion.label } : {}),
		...(criterion.description != null
			? { description: criterion.description }
			: {}),
	};
}
