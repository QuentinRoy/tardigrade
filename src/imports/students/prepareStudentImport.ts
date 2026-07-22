import type { NormalizedImportedGradeTarget } from "#imports/types.ts";

export type StudentImportContext = {
	// Imported student ids that already exist in the grid.
	existingStudentIds: Set<string>;
	// Imported student ids that already have their own individual grade target
	// (an unnamed, single-member target).
	existingIndividualGradeTargetStudentIds: Set<string>;
	// Imported group names that already have a grade target in the grid.
	existingGroupGradeTargetGroupNames: Set<string>;
};

export type StudentImportPlan = {
	writes: NormalizedImportedGradeTarget[];
	createdStudentIds: string[];
	updatedStudentIds: string[];
	createdGradeTargetIds: string[];
	updatedGradeTargetIds: string[];
};

export function prepareStudentImport(params: {
	targets: NormalizedImportedGradeTarget[];
	context: StudentImportContext;
}): StudentImportPlan {
	const { targets, context } = params;

	const createdStudentIds: string[] = [];
	const updatedStudentIds: string[] = [];
	const createdGradeTargetIds: string[] = [];
	const updatedGradeTargetIds: string[] = [];

	for (const target of targets) {
		for (const student of target.students) {
			if (context.existingStudentIds.has(student.id)) {
				updatedStudentIds.push(student.id);
			} else {
				createdStudentIds.push(student.id);
			}
		}

		// A group reconciles against an existing target by its name; an
		// individual against the existing one-member target for its student.
		const isExistingTarget =
			target.kind === "group"
				? target.group != null &&
					context.existingGroupGradeTargetGroupNames.has(target.group)
				: target.students[0] != null &&
					context.existingIndividualGradeTargetStudentIds.has(
						target.students[0].id,
					);

		if (isExistingTarget) {
			updatedGradeTargetIds.push(target.id);
		} else {
			createdGradeTargetIds.push(target.id);
		}
	}

	return {
		writes: targets,
		createdStudentIds,
		updatedStudentIds,
		createdGradeTargetIds,
		updatedGradeTargetIds,
	};
}
