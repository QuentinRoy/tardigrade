import type { Rubric } from "#rubrics/types.ts";

export type QuestionEditorValue = {
	id: string;
	label?: string | undefined;
	rubrics: RubricEditorValue[];
};

export type RubricEditorValue =
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			type: "boolean";
			marks: number;
			falseMarks?: number | undefined;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			type: "ordinal";
			marks: Record<string, number>;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			type: "numerical";
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

export type Question = { label?: string | undefined; rubrics: Rubric[] };

export type Grid = { [id: string]: Question };

// A Question plus the definition-level metadata an author edits in the
// management UI (see CONTEXT.md: "Question Definition").
export type QuestionDefinition = {
	id: string;
	position: number;
	assessmentCount: number;
	question: Question;
};

export function toEditorValue(item: QuestionDefinition): QuestionEditorValue {
	return {
		id: item.id,
		label: item.question.label,
		rubrics: item.question.rubrics.map((rubric) => {
			if (rubric.type === "boolean") {
				return {
					previousId: rubric.id,
					id: rubric.id,
					description: rubric.description,
					label: rubric.label,
					type: "boolean",
					marks: rubric.marks,
					falseMarks: rubric.falseMarks,
				};
			}

			if (rubric.type === "ordinal") {
				return {
					previousId: rubric.id,
					id: rubric.id,
					description: rubric.description,
					label: rubric.label,
					type: "ordinal",
					marks: rubric.marks,
				};
			}

			return {
				previousId: rubric.id,
				id: rubric.id,
				description: rubric.description,
				label: rubric.label,
				type: "numerical",
				minScore: rubric.minScore,
				maxScore: rubric.maxScore,
				minMarks: rubric.minMarks,
				maxMarks: rubric.maxMarks,
				reversed: rubric.reversed,
			};
		}),
	};
}

export function createEmptyQuestionEditorValue(): QuestionEditorValue {
	return { id: "", label: "", rubrics: [] };
}
