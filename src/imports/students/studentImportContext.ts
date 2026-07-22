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
		gridId,
	}: { targets: NormalizedImportedGradeTarget[]; gridId: string },
): Promise<StudentImportContext> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = grid.rowId;

	const studentIds = Array.from(
		new Set(
			targets.flatMap((target) => target.students.map((student) => student.id)),
		),
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
					.where("student.gridRowId", "=", gridRowId)
					.where("student.id", "in", studentIds)
					.select("student.id as id")
					.execute(),
		// An individual target is an unnamed target whose only member is the
		// student — that is what an individual re-import reconciles against.
		studentIds.length === 0
			? []
			: db
					.selectFrom("gradeTarget as gt")
					.innerJoin(
						"gradeTargetStudent as gts",
						"gts.gradeTargetRowId",
						"gt.rowId",
					)
					.innerJoin("student", "student.rowId", "gts.studentRowId")
					.where("gt.name", "is", null)
					.where("student.gridRowId", "=", gridRowId)
					.where("student.id", "in", studentIds)
					.where((eb) =>
						eb.not(
							eb.exists(
								eb
									.selectFrom("gradeTargetStudent as other")
									.whereRef(
										"other.gradeTargetRowId",
										"=",
										"gts.gradeTargetRowId",
									)
									.whereRef("other.studentRowId", "<>", "gts.studentRowId")
									.select("other.studentRowId"),
							),
						),
					)
					.select("student.id as studentId")
					.execute(),
		groupNames.length === 0
			? []
			: db
					.selectFrom("gradeTarget")
					.where("gradeTarget.gridRowId", "=", gridRowId)
					.where("gradeTarget.name", "in", groupNames)
					.select("gradeTarget.name as name")
					.execute(),
	]);

	return {
		existingStudentIds: new Set(studentRows.map((row) => row.id)),
		existingIndividualGradeTargetStudentIds: new Set(
			individualTargetRows.map((row) => row.studentId),
		),
		existingGroupGradeTargetGroupNames: new Set(
			groupRows.flatMap((row) => (row.name == null ? [] : [row.name])),
		),
	};
}
