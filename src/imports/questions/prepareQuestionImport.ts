import type { CriterionKind } from "#criteria/types.ts";
import type { ImportedQuestions } from "#imports/types.ts";

export type ExistingQuestionImportCriterion = {
	kind: CriterionKind;
	questionId: string;
	assessmentCount: number;
};

export type QuestionImportContext = {
	// Existing criteria keyed by criterion id, scoped to the project.
	existingCriteriaById: Map<string, ExistingQuestionImportCriterion>;
};

export type QuestionImportCriterionTypeChange = {
	questionId: string;
	criterionId: string;
	fromType: CriterionKind;
	toType: CriterionKind;
};

export type QuestionImportBlockingDiagnostic =
	| {
			kind: "criterion-type-change-blocked";
			questionId: string;
			criterionId: string;
			assessmentCount: number;
	  }
	| {
			kind: "criterion-question-mismatch";
			criterionId: string;
			importQuestionId: string;
			existingQuestionId: string;
	  };

export type QuestionImportPlan = {
	writes: ImportedQuestions;
	blockingDiagnostics: QuestionImportBlockingDiagnostic[];
	// Criterion type changes that proceed (no linked assessments), reported for the
	// success message.
	criterionTypeChanges: QuestionImportCriterionTypeChange[];
};

export function prepareQuestionImport(params: {
	questions: ImportedQuestions;
	context: QuestionImportContext;
}): QuestionImportPlan {
	const { questions, context } = params;
	const blockingDiagnostics: QuestionImportBlockingDiagnostic[] = [];
	const criterionTypeChanges: QuestionImportCriterionTypeChange[] = [];

	for (const question of questions) {
		for (const criterion of question.criteria) {
			const existing = context.existingCriteriaById.get(criterion.id);
			if (existing == null) {
				continue;
			}

			if (existing.questionId !== question.id) {
				blockingDiagnostics.push({
					kind: "criterion-question-mismatch",
					criterionId: criterion.id,
					importQuestionId: question.id,
					existingQuestionId: existing.questionId,
				});
				continue;
			}

			if (existing.kind === criterion.kind) {
				continue;
			}

			if (existing.assessmentCount > 0) {
				blockingDiagnostics.push({
					kind: "criterion-type-change-blocked",
					questionId: question.id,
					criterionId: criterion.id,
					assessmentCount: existing.assessmentCount,
				});
				continue;
			}

			criterionTypeChanges.push({
				questionId: question.id,
				criterionId: criterion.id,
				fromType: existing.kind,
				toType: criterion.kind,
			});
		}
	}

	return { writes: questions, blockingDiagnostics, criterionTypeChanges };
}
