import type { CriterionDefinitionInput } from "#criteria/types.ts";
import type { Rubric } from "#rubrics/types.ts";

export type RubricEditorValue = {
	id: string;
	label?: string | undefined;
	criteria: CriterionDefinitionInput[];
};

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
