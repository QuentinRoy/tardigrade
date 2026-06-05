import "server-only";
import type { Kysely } from "kysely";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db } from "#db/kysely.ts";
import type { NormalizedImportedSubmission } from "./types.ts";

// `db` may be the global client or a caller-supplied transaction; the import saver
// opens the transaction and invalidates cache after it commits.
export async function saveStudentsInDb(
	db: Kysely<DB>,
	{
		submissions,
		projectId,
	}: { submissions: NormalizedImportedSubmission[]; projectId: string },
): Promise<{ submissionCount: number; studentCount: number }> {
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

		return { type: submission.type, teamName: submission.team, studentId };
	});

	const studentsToUpsert = submissions.flatMap((submission) =>
		submission.students.map((student) => ({
			id: student.id,
			lastName: student.lastName,
			firstName: student.firstName,
			teamName: submission.type === "team" ? submission.team : undefined,
		})),
	);

	const projectRow = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = projectRow.rowId;

	const teamNames = new Set(
		submissionsByOwner
			.filter((s) => s.type === "team" && s.teamName)
			.map((s) => s.teamName!),
	);

	const teamsByName = new Map<string, number>();
	const studentRowIdsByImportedId = new Map<string, number>();

	if (teamNames.size > 0) {
		await db
			.insertInto("team")
			.values(
				Array.from(teamNames).map((teamName) => ({
					name: teamName,
					projectId: projectRowId,
				})),
			)
			.onConflict((conflict) =>
				conflict.columns(["name", "projectId"]).doNothing(),
			)
			.execute();

		const teamResults = await db
			.selectFrom("team")
			.select(["id", "name"])
			.where("name", "in", Array.from(teamNames))
			.where("projectId", "=", projectRowId)
			.execute();

		for (const team of teamResults) {
			teamsByName.set(team.name, team.id);
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
				.deleteFrom("studentToTeam")
				.where("studentId", "in", affectedStudentRowIds)
				.execute();
		}

		const studentTeamLinks = studentsToUpsert.flatMap((student) => {
			if (student.teamName == null) {
				return [];
			}

			const teamId = teamsByName.get(student.teamName);

			if (teamId == null) {
				throw new Error(
					`Team assignment is missing a mapped team for "${student.teamName}".`,
				);
			}

			const rowId = studentRowIdsByImportedId.get(student.id);

			if (rowId == null) {
				throw new Error(`Failed to resolve student row for ${student.id}.`);
			}

			return [{ studentId: rowId, teamId }];
		});

		if (studentTeamLinks.length > 0) {
			await db
				.insertInto("studentToTeam")
				.values(studentTeamLinks)
				.onConflict((conflict) =>
					conflict.columns(["studentId", "teamId"]).doNothing(),
				)
				.execute();
		}
	}

	const teamSubmissions = submissionsByOwner.flatMap((submission) => {
		if (submission.type !== "team") {
			return [];
		}

		const teamId =
			submission.teamName != null
				? teamsByName.get(submission.teamName)
				: undefined;

		if (teamId == null) {
			throw new Error(
				`Team submission is missing a mapped team for "${
					submission.teamName ?? "unknown"
				}".`,
			);
		}

		return [
			{
				type: "team" as const,
				projectId: projectRowId,
				teamId,
				studentId: null,
			},
		];
	});

	if (teamSubmissions.length > 0) {
		await db
			.insertInto("submission")
			.values(teamSubmissions)
			.onConflict((conflict) =>
				conflict
					.column("teamId")
					.doUpdateSet({
						type: "team",
						projectId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.projectId"),
						teamId: (expressionBuilder) =>
							expressionBuilder.ref("excluded.teamId"),
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
				teamId: null,
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
						teamId: null,
					}),
			)
			.execute();
	}

	return {
		submissionCount: submissionsByOwner.length,
		studentCount: studentsToUpsert.length,
	};
}

export async function saveStudents(
	submissions: NormalizedImportedSubmission[],
	projectId: string,
): Promise<{ submissionCount: number; studentCount: number }> {
	const result = await db
		.transaction()
		.execute((tx) => saveStudentsInDb(tx, { submissions, projectId }));

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from studentsImportAction (request scope); revalidateTag throws
	// outside a request.
	revalidateTag(CACHE_TAGS.submissions, "max");
	revalidateTag(CACHE_TAGS.assessments, "max");
	revalidateTag(CACHE_TAGS.assessmentsAll, "max");

	return result;
}
