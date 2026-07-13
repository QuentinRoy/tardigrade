import "server-only";
import type { Kysely } from "kysely";
import { invalidateStudentImport } from "#db/cacheInvalidation.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
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

// `db` may be the global client or a caller-supplied transaction. Executes a
// plan's writes; never opens a transaction and never invalidates cache.
export async function saveStudentImportPlanInDb(
	db: Kysely<Database>,
	{ plan, projectId }: { plan: StudentImportPlan; projectId: string },
): Promise<StudentImportWriteResult> {
	const targets = plan.writes;
	const targetsByOwner = targets.map((target) => {
		const firstStudent = target.students[0];
		let studentId: string | undefined;

		if (target.kind === "individual") {
			if (firstStudent == null) {
				throw new Error(
					`Individual grade target ${target.id} must include at least one student.`,
				);
			} else if (target.students.length > 1) {
				throw new Error(
					`Individual grade target ${target.id} cannot include more than one student.`,
				);
			}
			studentId = firstStudent.id;
		}

		return { kind: target.kind, groupName: target.group, studentId };
	});

	const studentsToUpsert = targets.flatMap((target) =>
		target.students.map((student) => ({
			id: student.id,
			lastName: student.lastName,
			firstName: student.firstName,
			groupName: target.kind === "group" ? target.group : undefined,
		})),
	);

	const projectRow = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = projectRow.rowId;

	const groupNames = new Set(
		targetsByOwner.flatMap((t) =>
			t.kind === "group" && t.groupName ? [t.groupName] : [],
		),
	);

	const groupsByName = new Map<string, number>();
	const studentRowIdsByImportedId = new Map<string, number>();

	if (groupNames.size > 0) {
		await db
			.insertInto("group")
			.values(
				Array.from(groupNames).map((groupName) => ({
					name: groupName,
					projectId: projectRowId,
				})),
			)
			.onConflict((conflict) =>
				conflict.columns(["name", "projectId"]).doNothing(),
			)
			.execute();

		const groupResults = await db
			.selectFrom("group")
			.select(["id", "name"])
			.where("name", "in", Array.from(groupNames))
			.where("projectId", "=", projectRowId)
			.execute();

		for (const group of groupResults) {
			groupsByName.set(group.name, group.id);
		}
	}

	if (studentsToUpsert.length > 0) {
		await db
			.insertInto("student")
			.values(
				studentsToUpsert.map((student) => ({
					id: student.id,
					lastName: student.lastName,
					firstName: student.firstName,
					projectId: projectRowId,
				})),
			)
			.onConflict((conflict) =>
				conflict
					.columns(["projectId", "id"])
					.doUpdateSet((expressionBuilder) => ({
						lastName: expressionBuilder.ref("excluded.lastName"),
						firstName: expressionBuilder.ref("excluded.firstName"),
						projectId: expressionBuilder.ref("excluded.projectId"),
					})),
			)
			.execute();

		const studentRows = await db
			.selectFrom("student")
			.select(["rowId", "id"])
			.where("projectId", "=", projectRowId)
			.where(
				"id",
				"in",
				Array.from(new Set(studentsToUpsert.map((student) => student.id))),
			)
			.execute();

		for (const student of studentRows) {
			studentRowIdsByImportedId.set(student.id, student.rowId);
		}

		const affectedStudentRowIds = Array.from(
			new Set(
				studentsToUpsert.map((student) => {
					const rowId = studentRowIdsByImportedId.get(student.id);

					if (rowId == null) {
						throw new Error(`Failed to resolve student row for ${student.id}.`);
					}

					return rowId;
				}),
			),
		);

		if (affectedStudentRowIds.length > 0) {
			await db
				.deleteFrom("studentToGroup")
				.where("studentId", "in", affectedStudentRowIds)
				.execute();
		}

		const studentGroupLinks = studentsToUpsert.flatMap((student) => {
			if (student.groupName == null) {
				return [];
			}

			const groupId = groupsByName.get(student.groupName);

			if (groupId == null) {
				throw new Error(
					`Group assignment is missing a mapped group for "${student.groupName}".`,
				);
			}

			const rowId = studentRowIdsByImportedId.get(student.id);

			if (rowId == null) {
				throw new Error(`Failed to resolve student row for ${student.id}.`);
			}

			return [{ studentId: rowId, groupId }];
		});

		if (studentGroupLinks.length > 0) {
			await db
				.insertInto("studentToGroup")
				.values(studentGroupLinks)
				.onConflict((conflict) =>
					conflict.columns(["studentId", "groupId"]).doNothing(),
				)
				.execute();
		}
	}

	const groupTargetOwners = targetsByOwner.flatMap((target) => {
		if (target.kind !== "group") {
			return [];
		}

		const groupRowId =
			target.groupName != null ? groupsByName.get(target.groupName) : undefined;

		if (groupRowId == null) {
			throw new Error(
				`Group grade target is missing a mapped group for "${
					target.groupName ?? "unknown"
				}".`,
			);
		}

		return [{ groupRowId }];
	});

	const individualTargetOwners = targetsByOwner.flatMap((target) => {
		if (target.kind !== "individual") {
			return [];
		}

		if (target.studentId == null) {
			throw new Error("Individual grade target is missing student id.");
		}

		return [
			{ studentRowId: studentRowIdsByImportedId.get(target.studentId) ?? null },
		];
	});

	// One reservation covers both batches: they write into the same table, so
	// a candidate id must never repeat across the two INSERT statements below.
	// A candidate that lands on an ON CONFLICT DO UPDATE path (an existing row)
	// is simply never persisted — `id` is never in that clause's SET list — so
	// this can leave gaps, never a collision (see nextGradeTargetIds).
	const generatedIds = await nextGradeTargetIds(db, {
		projectRowId,
		count: groupTargetOwners.length + individualTargetOwners.length,
	});
	function takeGeneratedId(index: number): string {
		const id = generatedIds[index];

		if (id == null) {
			throw new Error(
				`Failed to resolve a generated grade target id at index ${index}.`,
			);
		}

		return id;
	}

	const groupTargets = groupTargetOwners.map((owner, index) => ({
		id: takeGeneratedId(index),
		kind: "group" as const,
		projectId: projectRowId,
		groupRowId: owner.groupRowId,
		studentRowId: null,
	}));
	const individualTargets = individualTargetOwners.map((owner, index) => ({
		id: takeGeneratedId(groupTargetOwners.length + index),
		kind: "individual" as const,
		projectId: projectRowId,
		studentRowId: owner.studentRowId,
		groupRowId: null,
	}));

	if (groupTargets.length > 0) {
		await db
			.insertInto("gradeTarget")
			.values(groupTargets)
			.onConflict((conflict) =>
				conflict
					.column("groupRowId")
					.doUpdateSet({
						kind: "group",
						projectId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.projectId"),
						groupRowId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.groupRowId"),
						studentRowId: null,
					}),
			)
			.execute();
	}

	if (individualTargets.length > 0) {
		await db
			.insertInto("gradeTarget")
			.values(individualTargets)
			.onConflict((conflict) =>
				conflict
					.column("studentRowId")
					.doUpdateSet({
						kind: "individual",
						projectId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.projectId"),
						studentRowId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.studentRowId"),
						groupRowId: null,
					}),
			)
			.execute();
	}

	return {
		createdStudentCount: plan.createdStudentIds.length,
		updatedStudentCount: plan.updatedStudentIds.length,
		createdGradeTargetCount: plan.createdGradeTargetIds.length,
		updatedGradeTargetCount: plan.updatedGradeTargetIds.length,
	};
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveStudents(
	{
		targets,
		projectId,
	}: { targets: NormalizedImportedGradeTarget[]; projectId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<StudentImportWriteResult> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadStudentImportContextFromDb(tx, {
			targets,
			projectId,
		});
		const plan = prepareStudentImport({ targets, context });

		return saveStudentImportPlanInDb(tx, { plan, projectId });
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from studentsImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateStudentImport();

	return result;
}
