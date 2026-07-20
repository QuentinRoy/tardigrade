import type { Simplify } from "#utils/utils.ts";
import type { OptionsCriterionDefinitionInput } from "./optionsSchemas.ts";

// Canonical config and grade-content shapes for the Options criterion kind. The
// generic `Criterion`/`CriterionGrade` unions in ../types.ts assemble their
// `options` members from these, so this folder is the single owner of what an
// Options criterion is (ADR 0013).

type OptionsCriterionBase = {
	id: string;
	description?: string | undefined;
	label?: string | undefined;
};

// The Marks an Options criterion offers, keyed by label.
export type OptionsMarks = Record<string, number>;

export type OptionsCriterion = Simplify<
	OptionsCriterionBase & { kind: "options"; marks: OptionsMarks }
>;

export type OptionsCriterionGrade = {
	criterionId: string;
	kind: "options";
	selectedLabel: string;
};

export type OptionsCriterionGradeContent = { selectedLabel: string };

// Default value the authoring UI seeds a new Options criterion with. Lives here
// (not in optionsSchemas.ts) so client editors importing it don't pull zod into
// the browser bundle; the return type is still the schema output, imported
// type-only.
export function createOptionsCriterion(): OptionsCriterionDefinitionInput {
	return {
		id: "",
		kind: "options",
		label: "",
		description: "",
		marks: { Pass: 1, Fail: 0 },
	};
}

// Editor-value projection: the authored definition the management UI edits for
// an existing Options criterion (`previousId` carries the id the criterion is
// stored under, so a renamed id can be matched back on save).
export function toOptionsCriterionDefinitionInput(
	criterion: OptionsCriterion,
): OptionsCriterionDefinitionInput {
	return {
		previousId: criterion.id,
		id: criterion.id,
		description: criterion.description,
		label: criterion.label,
		kind: "options",
		marks: criterion.marks,
	};
}

export function markOptionsCriterion(
	criterion: OptionsCriterion & { grade: OptionsCriterionGradeContent },
): number {
	const { selectedLabel } = criterion.grade;
	const marksForLabel = criterion.marks[selectedLabel];
	if (marksForLabel == null) {
		throw new Error(
			`Selected label "${selectedLabel}" not found in criterion marks`,
		);
	}
	return marksForLabel;
}

// An unselected Options criterion scores 0 (`markCriterion` returns 0 for a null
// grade), so 0 participates in the range even when no label offers it.
export function getOptionsCriterionMaxMarks(
	criterion: OptionsCriterion,
): number {
	return Math.max(0, ...Object.values(criterion.marks));
}

export function getOptionsCriterionMinMarks(
	criterion: OptionsCriterion,
): number {
	return Math.min(0, ...Object.values(criterion.marks));
}

// Neutral display facts for the results/details projection (consumed by
// getCriterionDetails' exhaustive dispatch). Returns facts, not JSX.
export type OptionsPropertyDetails = {
	kind: "options";
	marksByLabel: Array<{ label: string; marks: number }>;
};

export function describeOptions(
	criterion: OptionsCriterion,
): OptionsPropertyDetails {
	return {
		kind: "options",
		marksByLabel: Object.entries(criterion.marks).map(([label, marks]) => ({
			label,
			marks,
		})),
	};
}

// CSV grade-value projection: the kind-specific cell value the export column
// carries for a graded Options criterion (the column shape stays owned by
// `export`).
export function exportOptionsGradeValue(
	grade: OptionsCriterionGradeContent,
): string {
	return grade.selectedLabel;
}

// CSV grade-value parse: the read mirror of exportOptionsGradeValue, turning an
// imported cell into Options grade content. Throws when the cell names a label
// the criterion does not offer; `imports` turns that into a row diagnostic. An
// empty `labels` means the offered labels are unknown, so membership is not
// checked.
export function parseOptionsGradeValue(
	value: string,
	criterion: { id: string; labels: string[] },
): OptionsCriterionGradeContent {
	if (criterion.labels.length > 0 && !criterion.labels.includes(value)) {
		throw new Error(
			`Invalid option label "${value}" for criterion ${criterion.id}`,
		);
	}

	return { selectedLabel: value };
}

// Whether two Options grades hold the same selection (used to skip no-op saves).
export function isSameOptionsGrade(
	grade: OptionsCriterionGradeContent,
	other: OptionsCriterionGradeContent,
): boolean {
	return grade.selectedLabel === other.selectedLabel;
}

// YAML-encode projection: the serializable object written for an Options
// criterion (ADR 0013 — the kind owns both decode and encode of the YAML
// contract). Optional text fields are omitted when absent, matching js-yaml's
// handling of `undefined`.
export function encodeOptionsCriterion(criterion: OptionsCriterion): {
	id: string;
	kind: "options";
	marks: OptionsMarks;
	label?: string;
	description?: string;
} {
	return {
		id: criterion.id,
		kind: criterion.kind,
		marks: criterion.marks,
		...(criterion.label != null ? { label: criterion.label } : {}),
		...(criterion.description != null
			? { description: criterion.description }
			: {}),
	};
}
