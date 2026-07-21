import "server-only";
import type { Kysely, Transaction } from "kysely";
import { invalidateStudentImport } from "#db/cacheInvalidation.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import { ImportBlockedError } from "#imports/importErrors.ts";
import type { NormalizedImportedGradeTarget } from "#imports/types.ts";
import {
	prepareStudentImport,
	type StudentImportPlan,
} from "./prepareStudentImport.ts";
import { loadStudentImportContextFromDb } from "./studentImportContext.ts";

export type StudentImportWriteResult = {
	createdStudentCount: number;
	updatedStudentCount: number;
	createdGradeTargetCount: number;
	updatedGradeTargetCount: number;
};

// A resolved import target: the students it should contain and the
// grade_target row that will hold them — reused (an existing group by name, or
// a student's existing individual target) or freshly created.
type ResolvedTarget = {
	name: string | null;
	studentRowIds: number[];
	targetRowId: number;
};

// `db` is a caller-supplied transaction; this write primitive cannot run on
// the global client. Executes a plan's writes; never opens a transaction and
// never invalidates cache.
export async function saveStudentImportPlanInDb(
	db: Transaction<Database>,
	{ plan, gridId }: { plan: StudentImportPlan; gridId: string },
): Promise<StudentImportWriteResult> {
	const targets = plan.writes;

	const gridRow = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = gridRow.rowId;

	const studentRowIdByImportedId = await upsertStudents(db, {
		targets,
		gridRowId,
	});
	function resolveStudentRowId(id: string): number {
		const rowId = studentRowIdByImportedId.get(id);
		if (rowId == null) {
			throw new Error(`Failed to resolve student row for ${id}.`);
		}
		return rowId;
	}

	// Reuse candidates: an existing group target keyed by (name, grid), and a
	// student's existing individual target (unnamed, sole member). Everything
	// else needs a fresh grade_target row.
	const [existingGroupTargetRowIdByName, reuseIndividualTargetRowIdByStudent] =
		await Promise.all([
			loadExistingGroupTargets(db, { targets, gridRowId }),
			loadReusableIndividualTargets(db, {
				targets,
				gridRowId,
				resolveStudentRowId,
			}),
		]);

	const resolved = await resolveTargets(db, {
		targets,
		gridRowId,
		resolveStudentRowId,
		existingGroupTargetRowIdByName,
		reuseIndividualTargetRowIdByStudent,
	});

	const membershipRows = resolved.flatMap((target) =>
		target.studentRowIds.map((studentRowId) => ({
			gradeTargetRowId: target.targetRowId,
			studentRowId,
		})),
	);

	// Partition Rule: a student belongs to at most one grade target. A CSV that
	// lists the same student under two targets can't be honoured.
	assertStudentsAppearOnce(membershipRows);

	// Replace membership: detach every imported student from wherever they are
	// now, then attach them to their resolved target. Capture their prior
	// targets first so the emptied-target handling below knows which to check.
	const affectedStudentRowIds = Array.from(
		new Set(membershipRows.map((row) => row.studentRowId)),
	);
	const priorTargetRowIds = await loadPriorTargetRowIds(db, {
		affectedStudentRowIds,
	});

	if (affectedStudentRowIds.length > 0) {
		await db
			.deleteFrom("gradeTargetStudent")
			.where("studentRowId", "in", affectedStudentRowIds)
			.execute();
	}
	if (membershipRows.length > 0) {
		await db.insertInto("gradeTargetStudent").values(membershipRows).execute();
	}

	await pruneOrRejectEmptiedTargets(db, { priorTargetRowIds });

	return {
		createdStudentCount: plan.createdStudentIds.length,
		updatedStudentCount: plan.updatedStudentIds.length,
		createdGradeTargetCount: plan.createdGradeTargetIds.length,
		updatedGradeTargetCount: plan.updatedGradeTargetIds.length,
	};
}

async function upsertStudents(
	db: Transaction<Database>,
	{
		targets,
		gridRowId,
	}: { targets: NormalizedImportedGradeTarget[]; gridRowId: number },
): Promise<Map<string, number>> {
	// One row per student id: a student listed under two targets (a partition
	// violation caught later by membership) must not appear twice here, or the
	// upsert would try to affect the same (grid, id) row twice in one statement.
	const studentsById = new Map(
		targets.flatMap((target) =>
			target.students.map((student) => [student.id, student] as const),
		),
	);
	const students = Array.from(studentsById.values());
	const studentRowIdByImportedId = new Map<string, number>();

	if (students.length === 0) {
		return studentRowIdByImportedId;
	}

	await db
		.insertInto("student")
		.values(
			students.map((student) => ({
				id: student.id,
				lastName: student.lastName,
				firstName: student.firstName,
				gridRowId,
			})),
		)
		.onConflict((conflict) =>
			conflict
				.columns(["gridRowId", "id"])
				.doUpdateSet((eb) => ({
					lastName: eb.ref("excluded.lastName"),
					firstName: eb.ref("excluded.firstName"),
				})),
		)
		.execute();

	const studentRows = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("gridRowId", "=", gridRowId)
		.where(
			"id",
			"in",
			Array.from(new Set(students.map((student) => student.id))),
		)
		.execute();

	for (const student of studentRows) {
		studentRowIdByImportedId.set(student.id, student.rowId);
	}

	return studentRowIdByImportedId;
}

async function loadExistingGroupTargets(
	db: Transaction<Database>,
	{
		targets,
		gridRowId,
	}: { targets: NormalizedImportedGradeTarget[]; gridRowId: number },
): Promise<Map<string, number>> {
	const groupNames = Array.from(
		new Set(
			targets.flatMap((target) =>
				target.kind === "group" && target.group != null ? [target.group] : [],
			),
		),
	);
	const byName = new Map<string, number>();

	if (groupNames.length === 0) {
		return byName;
	}

	const rows = await db
		.selectFrom("gradeTarget")
		.select(["rowId", "name"])
		.where("gridRowId", "=", gridRowId)
		.where("name", "in", groupNames)
		.execute();

	for (const row of rows) {
		if (row.name != null) {
			byName.set(row.name, row.rowId);
		}
	}

	return byName;
}

async function loadReusableIndividualTargets(
	db: Transaction<Database>,
	{
		targets,
		gridRowId,
		resolveStudentRowId,
	}: {
		targets: NormalizedImportedGradeTarget[];
		gridRowId: number;
		resolveStudentRowId: (id: string) => number;
	},
): Promise<Map<number, number>> {
	const studentRowIds = targets.flatMap((target) =>
		target.kind === "individual" && target.students[0] != null
			? [resolveStudentRowId(target.students[0].id)]
			: [],
	);
	const byStudentRowId = new Map<number, number>();

	if (studentRowIds.length === 0) {
		return byStudentRowId;
	}

	const rows = await db
		.selectFrom("gradeTargetStudent as gts")
		.innerJoin("gradeTarget as gt", "gt.rowId", "gts.gradeTargetRowId")
		.where("gt.gridRowId", "=", gridRowId)
		.where("gt.name", "is", null)
		.where("gts.studentRowId", "in", studentRowIds)
		// Sole member: no other student shares the target.
		.where((eb) =>
			eb.not(
				eb.exists(
					eb
						.selectFrom("gradeTargetStudent as other")
						.whereRef("other.gradeTargetRowId", "=", "gts.gradeTargetRowId")
						.whereRef("other.studentRowId", "<>", "gts.studentRowId")
						.select("other.studentRowId"),
				),
			),
		)
		.select(["gts.studentRowId", "gts.gradeTargetRowId"])
		.execute();

	for (const row of rows) {
		byStudentRowId.set(row.studentRowId, row.gradeTargetRowId);
	}

	return byStudentRowId;
}

async function resolveTargets(
	db: Transaction<Database>,
	{
		targets,
		gridRowId,
		resolveStudentRowId,
		existingGroupTargetRowIdByName,
		reuseIndividualTargetRowIdByStudent,
	}: {
		targets: NormalizedImportedGradeTarget[];
		gridRowId: number;
		resolveStudentRowId: (id: string) => number;
		existingGroupTargetRowIdByName: Map<string, number>;
		reuseIndividualTargetRowIdByStudent: Map<number, number>;
	},
): Promise<ResolvedTarget[]> {
	// First pass: the students each target should contain, its name, and the
	// existing row to reuse (if any).
	const drafts = targets.map((target) => {
		const studentRowIds = target.students.map((student) =>
			resolveStudentRowId(student.id),
		);

		if (target.kind === "group") {
			if (target.group == null) {
				throw new Error(`Group grade target ${target.id} is missing its name.`);
			}
			return {
				name: target.group,
				studentRowIds,
				reuseRowId: existingGroupTargetRowIdByName.get(target.group) ?? null,
			};
		}

		const studentRowId = studentRowIds[0];
		if (studentRowId == null || studentRowIds.length !== 1) {
			throw new Error(
				`Individual grade target ${target.id} must include exactly one student.`,
			);
		}
		return {
			name: null,
			studentRowIds,
			reuseRowId: reuseIndividualTargetRowIdByStudent.get(studentRowId) ?? null,
		};
	});

	// Reserve one fresh public id per target that has no row to reuse, then
	// insert those rows and map the reserved ids back to their new row ids.
	const newDrafts = drafts.filter((draft) => draft.reuseRowId == null);
	const reservedIds = await nextGradeTargetIds(db, {
		gridRowId,
		count: newDrafts.length,
	});

	const rowIdByReservedId = new Map<string, number>();
	if (newDrafts.length > 0) {
		const inserted = await db
			.insertInto("gradeTarget")
			.values(
				newDrafts.map((draft, index) => ({
					id: takeReservedId(reservedIds, index),
					name: draft.name,
					gridRowId,
				})),
			)
			.returning(["rowId", "id"])
			.execute();
		for (const row of inserted) {
			rowIdByReservedId.set(row.id, row.rowId);
		}
	}

	let newIndex = 0;
	return drafts.map((draft) => {
		if (draft.reuseRowId != null) {
			return {
				name: draft.name,
				studentRowIds: draft.studentRowIds,
				targetRowId: draft.reuseRowId,
			};
		}
		const reservedId = takeReservedId(reservedIds, newIndex);
		newIndex += 1;
		const targetRowId = rowIdByReservedId.get(reservedId);
		if (targetRowId == null) {
			throw new Error(
				`Failed to resolve a newly inserted grade target for id ${reservedId}.`,
			);
		}
		return {
			name: draft.name,
			studentRowIds: draft.studentRowIds,
			targetRowId,
		};
	});
}

function takeReservedId(reservedIds: string[], index: number): string {
	const id = reservedIds[index];
	if (id == null) {
		throw new Error(
			`Failed to resolve a reserved grade target id at index ${index}.`,
		);
	}
	return id;
}

function assertStudentsAppearOnce(
	membershipRows: { studentRowId: number }[],
): void {
	const seen = new Set<number>();
	for (const row of membershipRows) {
		if (seen.has(row.studentRowId)) {
			throw new ImportBlockedError(
				"A student appears in more than one group or row. Each student can " +
					"belong to only one group or be graded on their own. Remove the " +
					"duplicate and import again.",
			);
		}
		seen.add(row.studentRowId);
	}
}

async function loadPriorTargetRowIds(
	db: Transaction<Database>,
	{ affectedStudentRowIds }: { affectedStudentRowIds: number[] },
): Promise<number[]> {
	if (affectedStudentRowIds.length === 0) {
		return [];
	}

	const rows = await db
		.selectFrom("gradeTargetStudent")
		.select("gradeTargetRowId")
		.where("studentRowId", "in", affectedStudentRowIds)
		.execute();

	return Array.from(new Set(rows.map((row) => row.gradeTargetRowId)));
}

async function pruneOrRejectEmptiedTargets(
	db: Transaction<Database>,
	{ priorTargetRowIds }: { priorTargetRowIds: number[] },
): Promise<void> {
	if (priorTargetRowIds.length === 0) {
		return;
	}

	// Only a target that lost members this import can be left empty; a resolved
	// target always gains at least one.
	const emptied = await db
		.selectFrom("gradeTarget as gt")
		.where("gt.rowId", "in", priorTargetRowIds)
		.where((eb) =>
			eb.not(
				eb.exists(
					eb
						.selectFrom("gradeTargetStudent as gts")
						.whereRef("gts.gradeTargetRowId", "=", "gt.rowId")
						.select("gts.studentRowId"),
				),
			),
		)
		.select(["gt.rowId as rowId", "gt.name as name"])
		.execute();

	// An emptied unnamed target is a vacated individual (its student was
	// reassigned into a group) — deleting it is the reassignment (moving a
	// student solo→group is a move, not a fork; ADR 0014). An emptied *named*
	// group is different: dropping it would silently discard a named group and
	// its grades, so refuse the import instead (draft targets are #61, out of
	// scope here).
	const namedEmptied = emptied.filter((target) => target.name != null);
	if (namedEmptied.length > 0) {
		throw new ImportBlockedError(
			"This import would leave one or more groups with no members. Add at " +
				"least one student to each group, or remove those groups from the " +
				"file, and import again.",
		);
	}

	const vacatedIndividualRowIds = emptied
		.filter((target) => target.name == null)
		.map((target) => target.rowId);
	if (vacatedIndividualRowIds.length > 0) {
		await db
			.deleteFrom("gradeTarget")
			.where("rowId", "in", vacatedIndividualRowIds)
			.execute();
	}
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveStudents(
	{
		targets,
		gridId,
	}: { targets: NormalizedImportedGradeTarget[]; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<StudentImportWriteResult> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadStudentImportContextFromDb(tx, {
			targets,
			gridId,
		});
		const plan = prepareStudentImport({ targets, context });

		return saveStudentImportPlanInDb(tx, { plan, gridId });
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from studentsImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateStudentImport({ gridId });

	return result;
}
