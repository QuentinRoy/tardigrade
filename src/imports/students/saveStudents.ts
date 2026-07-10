import "server-only";
import type { Kysely } from "kysely";
import { invalidateStudentImport } from "#db/cacheInvalidation.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import type { NormalizedImportedSubmission } from "#imports/types.ts";
import {
	prepareStudentImport,
	type StudentImportPlan,
} from "./prepareStudentImport.ts";
import { loadStudentImportContextFromDb } from "./studentImportContext.ts";

export type StudentImportWriteResult = {
	createdStudentCount: number;
	updatedStudentCount: number;
	createdSubmissionCount: number;
	updatedSubmissionCount: number;
};

// `db` may be the global client or a caller-supplied transaction. Executes a
// plan's writes; never opens a transaction and never invalidates cache.
export async function saveStudentImportPlanInDb(
	db: Kysely<DB>,
	{ plan, projectId }: { plan: StudentImportPlan; projectId: string },
): Promise<StudentImportWriteResult> {
	const submissions = plan.writes;
	const submissionsByOwner = submissions.map((submission) => {
		const firstStudent = submission.students[0];
		let studentId: string | undefined;

		if (submission.type === "individual") {
			if (firstStudent == null) {
				throw new Error(
					`Individual submission ${submission.id} must include at least one student.`,
				);
			} else if (submission.students.length > 1) {
				throw new Error(
					`Individual submission ${submission.id} cannot include more than one student.`,
				);
			}
			studentId = firstStudent.id;
		}

		return { type: submission.type, groupName: submission.group, studentId };
	});

	const studentsToUpsert = submissions.flatMap((submission) =>
		submission.students.map((student) => ({
			id: student.id,
			lastName: student.lastName,
			firstName: student.firstName,
			groupName: submission.type === "group" ? submission.group : undefined,
		})),
	);

	const projectRow = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = projectRow.rowId;

	const groupNames = new Set(
		submissionsByOwner.flatMap((s) =>
			s.type === "group" && s.groupName ? [s.groupName] : [],
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

	const groupSubmissions = submissionsByOwner.flatMap((submission) => {
		if (submission.type !== "group") {
			return [];
		}

		const groupId =
			submission.groupName != null
				? groupsByName.get(submission.groupName)
				: undefined;

		if (groupId == null) {
			throw new Error(
				`Group submission is missing a mapped group for "${
					submission.groupName ?? "unknown"
				}".`,
			);
		}

		return [
			{
				type: "group" as const,
				projectId: projectRowId,
				groupId,
				studentId: null,
			},
		];
	});

	if (groupSubmissions.length > 0) {
		await db
			.insertInto("submission")
			.values(groupSubmissions)
			.onConflict((conflict) =>
				conflict
					.column("groupId")
					.doUpdateSet({
						type: "group",
						projectId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.projectId"),
						groupId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.groupId"),
						studentId: null,
					}),
			)
			.execute();
	}

	const individualSubmissions = submissionsByOwner.flatMap((submission) => {
		if (submission.type !== "individual") {
			return [];
		}

		if (submission.studentId == null) {
			throw new Error("Individual submission is missing student id.");
		}

		return [
			{
				type: "individual" as const,
				projectId: projectRowId,
				studentId: studentRowIdsByImportedId.get(submission.studentId) ?? null,
				groupId: null,
			},
		];
	});

	if (individualSubmissions.length > 0) {
		await db
			.insertInto("submission")
			.values(individualSubmissions)
			.onConflict((conflict) =>
				conflict
					.column("studentId")
					.doUpdateSet({
						type: "individual",
						projectId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.projectId"),
						studentId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.studentId"),
						groupId: null,
					}),
			)
			.execute();
	}

	return {
		createdStudentCount: plan.createdStudentIds.length,
		updatedStudentCount: plan.updatedStudentIds.length,
		createdSubmissionCount: plan.createdSubmissionIds.length,
		updatedSubmissionCount: plan.updatedSubmissionIds.length,
	};
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveStudents(
	{
		submissions,
		projectId,
	}: { submissions: NormalizedImportedSubmission[]; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<StudentImportWriteResult> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadStudentImportContextFromDb(tx, {
			submissions,
			projectId,
		});
		const plan = prepareStudentImport({ submissions, context });

		return saveStudentImportPlanInDb(tx, { plan, projectId });
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from studentsImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateStudentImport();

	return result;
}
