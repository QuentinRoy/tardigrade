import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import type { StudentImportContext } from "./prepareStudentImport.ts";
import type { NormalizedImportedSubmission } from "./types.ts";

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

	const teamNames = Array.from(
		new Set(
			submissions.flatMap((submission) =>
				submission.type === "team" && submission.team != null
					? [submission.team]
					: [],
			),
		),
	);

	const [studentRows, individualSubmissionRows, teamRows] = await Promise.all([
		studentIds.length === 0
			? []
			: db
					.selectFrom("student")
					.leftJoin("studentToTeam", "studentToTeam.studentId", "student.rowId")
					.leftJoin("team", "team.id", "studentToTeam.teamId")
					.where("student.projectId", "=", projectRowId)
					.where("student.id", "in", studentIds)
					.select([
						"student.id as id",
						"student.lastName as lastName",
						"student.firstName as firstName",
						"team.name as teamName",
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
		teamNames.length === 0
			? []
			: db
					.selectFrom("team")
					.innerJoin("submission", "submission.teamId", "team.id")
					.where("team.projectId", "=", projectRowId)
					.where("team.name", "in", teamNames)
					.select("team.name as name")
					.execute(),
	]);

	const existingStudentsById: StudentImportContext["existingStudentsById"] =
		new Map(
			studentRows.map((row) => [
				row.id,
				{
					lastName: row.lastName,
					firstName: row.firstName,
					teamName: row.teamName ?? undefined,
				},
			]),
		);

	const existingIndividualSubmissionStudentIds: StudentImportContext["existingIndividualSubmissionStudentIds"] =
		new Set(individualSubmissionRows.map((row) => row.studentId));

	const existingTeamSubmissionTeamNames: StudentImportContext["existingTeamSubmissionTeamNames"] =
		new Set(teamRows.map((row) => row.name));

	return {
		existingStudentsById,
		existingIndividualSubmissionStudentIds,
		existingTeamSubmissionTeamNames,
	};
}
