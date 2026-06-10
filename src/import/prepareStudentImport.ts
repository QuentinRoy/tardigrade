import type { NormalizedImportedSubmission } from "./types.ts";

export type ExistingStudentImportRecord = {
	lastName: string;
	firstName: string;
	teamName?: string | undefined;
};

export type StudentImportContext = {
	// Existing students keyed by imported student id, scoped to the project.
	existingStudentsById: Map<string, ExistingStudentImportRecord>;
	// Student ids that already have an individual submission.
	existingIndividualSubmissionStudentIds: Set<string>;
	// Team names that already have a submission.
	existingTeamSubmissionTeamNames: Set<string>;
};

export type StudentImportTeamMembershipChange = {
	studentId: string;
	fromTeam?: string | undefined;
	toTeam?: string | undefined;
};

export type StudentImportPlan = {
	writes: NormalizedImportedSubmission[];
	createdStudentIds: string[];
	updatedStudentIds: string[];
	createdSubmissionIds: string[];
	updatedSubmissionIds: string[];
	teamMembershipChanges: StudentImportTeamMembershipChange[];
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
	const teamMembershipChanges: StudentImportTeamMembershipChange[] = [];

	for (const submission of submissions) {
		const newTeamName =
			submission.type === "team" ? submission.team : undefined;

		for (const student of submission.students) {
			const existing = context.existingStudentsById.get(student.id);

			if (existing == null) {
				createdStudentIds.push(student.id);
			} else {
				updatedStudentIds.push(student.id);

				if (existing.teamName !== newTeamName) {
					teamMembershipChanges.push({
						studentId: student.id,
						fromTeam: existing.teamName,
						toTeam: newTeamName,
					});
				}
			}
		}

		if (submission.type === "team") {
			if (
				newTeamName != null &&
				context.existingTeamSubmissionTeamNames.has(newTeamName)
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
		teamMembershipChanges,
	};
}
