import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import type { NormalizedImportedSubmission } from "#imports/types.ts";
import type { StudentImportContext } from "./prepareStudentImport.ts";

// `db` may be the global client or a caller-supplied transaction. Fetches
// everything prepareStudentImport() needs, driven by the parsed submissions.
export async function loadStudentImportContextFromDb(
	db: Kysely<DB>,
	{
		submissions,
		projectId,
	}: { submissions: NormalizedImportedSubmission[]; projectId: string },
): Promise<StudentImportContext> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const studentIds = submissions.flatMap((submission) =>
		submission.students.map((student) => student.id),
	);

	const groupNames = Array.from(
		new Set(
			submissions.flatMap((submission) =>
				submission.type === "group" && submission.group != null
					? [submission.group]
					: [],
			),
		),
	);

	const [studentRows, individualSubmissionRows, groupRows] = await Promise.all([
		studentIds.length === 0
			? []
			: db
					.selectFrom("student")
					.leftJoin(
						"studentToGroup",
						"studentToGroup.studentId",
						"student.rowId",
					)
					.leftJoin("group", "group.id", "studentToGroup.groupId")
					.where("student.projectId", "=", projectRowId)
					.where("student.id", "in", studentIds)
					.select([
						"student.id as id",
						"student.lastName as lastName",
						"student.firstName as firstName",
						"group.name as groupName",
					])
					.execute(),
		studentIds.length === 0
			? []
			: db
					.selectFrom("submission")
					.innerJoin("student", "student.rowId", "submission.studentId")
					.where("submission.type", "=", "individual")
					.where("student.projectId", "=", projectRowId)
					.where("student.id", "in", studentIds)
					.select("student.id as studentId")
					.execute(),
		groupNames.length === 0
			? []
			: db
					.selectFrom("group")
					.innerJoin("submission", "submission.groupId", "group.id")
					.where("group.projectId", "=", projectRowId)
					.where("group.name", "in", groupNames)
					.select("group.name as name")
					.execute(),
	]);

	const existingStudentsById: StudentImportContext["existingStudentsById"] =
		new Map(
			studentRows.map((row) => [
				row.id,
				{
					lastName: row.lastName,
					firstName: row.firstName,
					groupName: row.groupName ?? undefined,
				},
			]),
		);

	const existingIndividualSubmissionStudentIds: StudentImportContext["existingIndividualSubmissionStudentIds"] =
		new Set(individualSubmissionRows.map((row) => row.studentId));

	const existingGroupSubmissionGroupNames: StudentImportContext["existingGroupSubmissionGroupNames"] =
		new Set(groupRows.map((row) => row.name));

	return {
		existingStudentsById,
		existingIndividualSubmissionStudentIds,
		existingGroupSubmissionGroupNames,
	};
}
