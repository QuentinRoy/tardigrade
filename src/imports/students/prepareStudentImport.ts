import type { NormalizedImportedSubmission } from "#imports/types.ts";

export type ExistingStudentImportRecord = {
	lastName: string;
	firstName: string;
	groupName?: string | undefined;
};

export type StudentImportContext = {
	// Existing students keyed by imported student id, scoped to the project.
	existingStudentsById: Map<string, ExistingStudentImportRecord>;
	// Student ids that already have an individual submission.
	existingIndividualSubmissionStudentIds: Set<string>;
	// Group names that already have a submission.
	existingGroupSubmissionGroupNames: Set<string>;
};

export type StudentImportGroupMembershipChange = {
	studentId: string;
	fromGroup?: string | undefined;
	toGroup?: string | undefined;
};

export type StudentImportPlan = {
	writes: NormalizedImportedSubmission[];
	createdStudentIds: string[];
	updatedStudentIds: string[];
	createdSubmissionIds: string[];
	updatedSubmissionIds: string[];
	groupMembershipChanges: StudentImportGroupMembershipChange[];
};

export function prepareStudentImport(params: {
	submissions: NormalizedImportedSubmission[];
	context: StudentImportContext;
}): StudentImportPlan {
	const { submissions, context } = params;

	const createdStudentIds: string[] = [];
	const updatedStudentIds: string[] = [];
	const createdSubmissionIds: string[] = [];
	const updatedSubmissionIds: string[] = [];
	const groupMembershipChanges: StudentImportGroupMembershipChange[] = [];

	for (const submission of submissions) {
		const newGroupName =
			submission.type === "group" ? submission.group : undefined;

		for (const student of submission.students) {
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

		if (submission.type === "group") {
			if (
				newGroupName != null &&
				context.existingGroupSubmissionGroupNames.has(newGroupName)
			) {
				updatedSubmissionIds.push(submission.id);
			} else {
				createdSubmissionIds.push(submission.id);
			}
		} else {
			const studentId = submission.students[0]?.id;
			if (
				studentId != null &&
				context.existingIndividualSubmissionStudentIds.has(studentId)
			) {
				updatedSubmissionIds.push(submission.id);
			} else {
				createdSubmissionIds.push(submission.id);
			}
		}
	}

	return {
		writes: submissions,
		createdStudentIds,
		updatedStudentIds,
		createdSubmissionIds,
		updatedSubmissionIds,
		groupMembershipChanges,
	};
}
