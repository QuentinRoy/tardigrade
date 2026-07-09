import type { CriterionKind } from "#criteria/types.ts";
import type { ImportedRubrics } from "#imports/types.ts";

export type ExistingRubricImportCriterion = {
	kind: CriterionKind;
	rubricId: string;
	assessmentCount: number;
};

export type RubricImportContext = {
	// Existing criteria keyed by criterion id, scoped to the project.
	existingCriteriaById: Map<string, ExistingRubricImportCriterion>;
};

export type RubricImportCriterionKindChange = {
	rubricId: string;
	criterionId: string;
	fromKind: CriterionKind;
	toKind: CriterionKind;
};

export type RubricImportBlockingDiagnostic =
	| {
			kind: "criterion-kind-change-blocked";
			rubricId: string;
			criterionId: string;
			assessmentCount: number;
	  }
	| {
			kind: "criterion-rubric-mismatch";
			criterionId: string;
			importRubricId: string;
			existingRubricId: string;
	  };

export type RubricImportPlan = {
	writes: ImportedRubrics;
	blockingDiagnostics: RubricImportBlockingDiagnostic[];
	// Criterion type changes that proceed (no linked assessments), reported for the
	// success message.
	criterionKindChanges: RubricImportCriterionKindChange[];
};

export function prepareRubricImport(params: {
	rubrics: ImportedRubrics;
	context: RubricImportContext;
}): RubricImportPlan {
	const { rubrics, context } = params;
	const blockingDiagnostics: RubricImportBlockingDiagnostic[] = [];
	const criterionKindChanges: RubricImportCriterionKindChange[] = [];

	for (const rubric of rubrics) {
		for (const criterion of rubric.criteria) {
			const existing = context.existingCriteriaById.get(criterion.id);
			if (existing == null) {
				continue;
			}

			if (existing.rubricId !== rubric.id) {
				blockingDiagnostics.push({
					kind: "criterion-rubric-mismatch",
					criterionId: criterion.id,
					importRubricId: rubric.id,
					existingRubricId: existing.rubricId,
				});
				continue;
			}

			if (existing.kind === criterion.kind) {
				continue;
			}

			if (existing.assessmentCount > 0) {
				blockingDiagnostics.push({
					kind: "criterion-kind-change-blocked",
					rubricId: rubric.id,
					criterionId: criterion.id,
					assessmentCount: existing.assessmentCount,
				});
				continue;
			}

			criterionKindChanges.push({
				rubricId: rubric.id,
				criterionId: criterion.id,
				fromKind: existing.kind,
				toKind: criterion.kind,
			});
		}
	}

	return { writes: rubrics, blockingDiagnostics, criterionKindChanges };
}
