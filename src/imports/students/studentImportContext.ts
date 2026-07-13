import "server-only";
import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { NormalizedImportedGradeTarget } from "#imports/types.ts";
import type { StudentImportContext } from "./prepareStudentImport.ts";

// `db` may be the global client or a caller-supplied transaction. Fetches
// everything prepareStudentImport() needs, driven by the parsed grade targets.
export async function loadStudentImportContextFromDb(
	db: Kysely<Database>,
	{
		targets,
		projectId,
	}: { targets: NormalizedImportedGradeTarget[]; projectId: string },
): Promise<StudentImportContext> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const studentIds = targets.flatMap((target) =>
		target.students.map((student) => student.id),
	);

	const groupNames = Array.from(
		new Set(
			targets.flatMap((target) =>
				target.kind === "group" && target.group != null ? [target.group] : [],
			),
		),
	);

	const [studentRows, individualTargetRows, groupRows] = await Promise.all([
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
					.selectFrom("gradeTarget")
					.innerJoin("student", "student.rowId", "gradeTarget.studentRowId")
					.where("gradeTarget.kind", "=", "individual")
					.where("student.projectId", "=", projectRowId)
					.where("student.id", "in", studentIds)
					.select("student.id as studentId")
					.execute(),
		groupNames.length === 0
			? []
			: db
					.selectFrom("group")
					.innerJoin("gradeTarget", "gradeTarget.groupRowId", "group.id")
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

	const existingIndividualGradeTargetStudentIds: StudentImportContext["existingIndividualGradeTargetStudentIds"] =
		new Set(individualTargetRows.map((row) => row.studentId));

	const existingGroupGradeTargetGroupNames: StudentImportContext["existingGroupGradeTargetGroupNames"] =
		new Set(groupRows.map((row) => row.name));

	return {
		existingStudentsById,
		existingIndividualGradeTargetStudentIds,
		existingGroupGradeTargetGroupNames,
	};
}
