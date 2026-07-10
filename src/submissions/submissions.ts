import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import { cacheTags, submissionListCacheTag } from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import type { Submission } from "./types.ts";

export function submissionsCacheTags(): string[] {
	return [submissionListCacheTag()];
}

function normalizeSearchValue(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatStudentName(lastName: string, firstName: string): string {
	return `${lastName} ${firstName}`.trim();
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadSubmissionsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId?: string | undefined } = {},
) {
	let submissionsQuery = db.selectFrom("submission");
	let groupMemberQuery = db.selectFrom("submission");

	if (projectId != null) {
		const projectRowIdQuery = db
			.selectFrom("project")
			.select("rowId")
			.where("id", "=", projectId);

		submissionsQuery = submissionsQuery.where(
			"submission.projectId",
			"in",
			projectRowIdQuery,
		);
		groupMemberQuery = groupMemberQuery.where(
			"submission.projectId",
			"in",
			projectRowIdQuery,
		);
	}

	const [submissions, groupMemberRows] = await Promise.all([
		submissionsQuery
			.leftJoin("student", "student.rowId", "submission.studentId")
			.leftJoin("group", "group.id", "submission.groupId")
			.select([
				"submission.id as id",
				"submission.type as type",
				"student.lastName as studentLastName",
				"student.firstName as studentFirstName",
				"group.name as groupName",
			])
			.orderBy("submission.id", "asc")
			.execute(),
		groupMemberQuery
			.innerJoin(
				"studentToGroup",
				"studentToGroup.groupId",
				"submission.groupId",
			)
			.innerJoin("student", "student.rowId", "studentToGroup.studentId")
			.where("submission.type", "=", "group")
			.select([
				"submission.id as submissionId",
				"student.lastName as studentLastName",
				"student.firstName as studentFirstName",
			])
			.orderBy("submission.id", "asc")
			.orderBy("student.lastName", "asc")
			.orderBy("student.firstName", "asc")
			.execute(),
	]);

	const groupMembersBySubmissionId = new Map<string, string[]>();

	for (const row of groupMemberRows) {
		if (row.studentLastName == null || row.studentFirstName == null) {
			continue;
		}

		const submissionId = String(row.submissionId);
		const formattedName = formatStudentName(
			row.studentLastName,
			row.studentFirstName,
		);
		if (formattedName.length === 0) {
			continue;
		}
		const names = groupMembersBySubmissionId.get(submissionId) ?? [];
		names.push(formattedName);
		groupMembersBySubmissionId.set(submissionId, names);
	}

	return { submissions, groupMembersBySubmissionId };
}

// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadSubmissions(
	{ projectId }: { projectId?: string } = {},
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Submission[]> {
	"use cache";
	cacheTags(...submissionsCacheTags());
	cacheLife("roster");

	const { submissions, groupMembersBySubmissionId } =
		await loadSubmissionsFromDb(db, { projectId });

	return submissions.map((submission) => {
		if (submission.type === "group") {
			const displayLabel = submission.groupName ?? String(submission.id);
			const memberNames =
				groupMembersBySubmissionId.get(String(submission.id)) ?? [];
			const searchKeys = Array.from(
				new Set(
					[displayLabel, ...memberNames]
						.map(normalizeSearchValue)
						.filter((value) => value.length > 0),
				),
			);

			return {
				id: String(submission.id),
				type: "group",
				groupName: displayLabel,
				displayLabel,
				memberNames,
				searchKeys,
			};
		}

		const displayLabel =
			submission.studentLastName != null && submission.studentFirstName != null
				? formatStudentName(
						submission.studentLastName,
						submission.studentFirstName,
					)
				: String(submission.id);
		const searchKeys = [normalizeSearchValue(displayLabel)].filter(
			(value) => value.length > 0,
		);

		return {
			id: String(submission.id),
			type: "individual",
			studentName: displayLabel,
			displayLabel,
			memberNames: [],
			searchKeys,
		};
	});
}
