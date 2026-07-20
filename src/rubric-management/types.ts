import { toCriterionDefinitionInput } from "#criteria/criterionDefinitionInput.ts";
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
		criteria: item.rubric.criteria.map(toCriterionDefinitionInput),
	};
}

export function createEmptyRubricEditorValue(): RubricEditorValue {
	return { id: "", label: "", criteria: [] };
}
