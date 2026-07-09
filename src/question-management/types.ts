import type { Question } from "#questions/types.ts";

export type QuestionEditorValue = {
	id: string;
	label?: string | undefined;
	criteria: CriterionEditorValue[];
};

export type CriterionEditorValue =
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			kind: "check";
			marks: number;
			falseMarks?: number | undefined;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			kind: "options";
			marks: Record<string, number>;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			kind: "number";
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

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
		criteria: item.question.criteria.map((criterion) => {
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
				minScore: criterion.minScore,
				maxScore: criterion.maxScore,
				minMarks: criterion.minMarks,
				maxMarks: criterion.maxMarks,
				reversed: criterion.reversed,
			};
		}),
	};
}

export function createEmptyQuestionEditorValue(): QuestionEditorValue {
	return { id: "", label: "", criteria: [] };
}
