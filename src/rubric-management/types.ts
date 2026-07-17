import type { CheckCriterionEditorValue } from "#criteria/check/checkSchemas.ts";
import type { NumberCriterionEditorValue } from "#criteria/number/numberSchemas.ts";
import type { Rubric } from "#rubrics/types.ts";

export type RubricEditorValue = {
	id: string;
	label?: string | undefined;
	criteria: CriterionEditorValue[];
};

export type CriterionEditorValue =
	| CheckCriterionEditorValue
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			kind: "options";
			marks: Record<string, number>;
	  }
	| NumberCriterionEditorValue;

// A Rubric plus the definition-level metadata an author edits in the
// management UI (see CONTEXT.md: "Rubric Definition").
export type RubricDefinition = {
	id: string;
	position: number;
	gradedTargetCount: number;
	rubric: Rubric;
};

export function toEditorValue(item: RubricDefinition): RubricEditorValue {
	return {
		id: item.id,
		label: item.rubric.label,
		criteria: item.rubric.criteria.map((criterion) => {
			if (criterion.kind === "check") {
				return {
					previousId: criterion.id,
					id: criterion.id,
					description: criterion.description,
					label: criterion.label,
					kind: "check",
					marks: criterion.marks,
					falseMarks: criterion.falseMarks,
				};
			}

			if (criterion.kind === "options") {
				return {
					previousId: criterion.id,
					id: criterion.id,
					description: criterion.description,
					label: criterion.label,
					kind: "options",
					marks: criterion.marks,
				};
			}

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
		}),
	};
}

export function createEmptyRubricEditorValue(): RubricEditorValue {
	return { id: "", label: "", criteria: [] };
}
