import type { NormalizedImportedGradeTarget } from "#imports/types.ts";

export type ExistingStudentImportRecord = {
	lastName: string;
	firstName: string;
	groupName?: string | undefined;
};

export type StudentImportContext = {
	// Existing students keyed by imported student id, scoped to the project.
	existingStudentsById: Map<string, ExistingStudentImportRecord>;
	// Student ids that already have an individual grade target.
	existingIndividualGradeTargetStudentIds: Set<string>;
	// Group names that already have a grade target.
	existingGroupGradeTargetGroupNames: Set<string>;
};

export type StudentImportGroupMembershipChange = {
	studentId: string;
	fromGroup?: string | undefined;
	toGroup?: string | undefined;
};

export type StudentImportPlan = {
	writes: NormalizedImportedGradeTarget[];
	createdStudentIds: string[];
	updatedStudentIds: string[];
	createdGradeTargetIds: string[];
	updatedGradeTargetIds: string[];
	groupMembershipChanges: StudentImportGroupMembershipChange[];
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
	const groupMembershipChanges: StudentImportGroupMembershipChange[] = [];

	for (const target of targets) {
		const newGroupName = target.kind === "group" ? target.group : undefined;

		for (const student of target.students) {
			const existing = context.existingStudentsById.get(student.id);

			if (existing == null) {
				createdStudentIds.push(student.id);
			} else {
				updatedStudentIds.push(student.id);

				if (existing.groupName !== newGroupName) {
					groupMembershipChanges.push({
						studentId: student.id,
						fromGroup: existing.groupName,
						toGroup: newGroupName,
					});
				}
			}
		}

		if (target.kind === "group") {
			if (
				newGroupName != null &&
				context.existingGroupGradeTargetGroupNames.has(newGroupName)
			) {
				updatedGradeTargetIds.push(target.id);
			} else {
				createdGradeTargetIds.push(target.id);
			}
		} else {
			const studentId = target.students[0]?.id;
			if (
				studentId != null &&
				context.existingIndividualGradeTargetStudentIds.has(studentId)
			) {
				updatedGradeTargetIds.push(target.id);
			} else {
				createdGradeTargetIds.push(target.id);
			}
		}
	}

	return {
		writes: targets,
		createdStudentIds,
		updatedStudentIds,
		createdGradeTargetIds,
		updatedGradeTargetIds,
		groupMembershipChanges,
	};
}
