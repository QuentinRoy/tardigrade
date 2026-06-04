import "server-only";
import type { Kysely } from "kysely";
import { CACHE_TAGS, cacheTags } from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db } from "#db/kysely.ts";
import type { Submission } from "./types.ts";

function normalizeSearchValue(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatStudentName(lastName: string, firstName: string): string {
	return `${lastName} ${firstName}`.trim();
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadSubmissionsFromDb(
	db: Kysely<DB>,
	projectId?: string,
) {
	let submissionsQuery = db.selectFrom("submission");
	let teamMemberQuery = db.selectFrom("submission");

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
		teamMemberQuery = teamMemberQuery.where(
			"submission.projectId",
			"in",
			projectRowIdQuery,
		);
	}

	const [submissions, teamMemberRows] = await Promise.all([
		submissionsQuery
			.leftJoin("student", "student.rowId", "submission.studentId")
			.leftJoin("team", "team.id", "submission.teamId")
			.select([
				"submission.id as id",
				"submission.type as type",
				"student.lastName as studentLastName",
				"student.firstName as studentFirstName",
				"team.name as teamName",
			])
			.orderBy("submission.id", "asc")
			.execute(),
		teamMemberQuery
			.innerJoin("studentToTeam", "studentToTeam.teamId", "submission.teamId")
			.innerJoin("student", "student.rowId", "studentToTeam.studentId")
			.where("submission.type", "=", "team")
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

	const teamMembersBySubmissionId = new Map<string, string[]>();

	for (const row of teamMemberRows) {
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
		const names = teamMembersBySubmissionId.get(submissionId) ?? [];
		names.push(formattedName);
		teamMembersBySubmissionId.set(submissionId, names);
	}

	return { submissions, teamMembersBySubmissionId };
}

export async function loadSubmissions(
	projectId?: string,
): Promise<Submission[]> {
	"use cache";
	cacheTags(CACHE_TAGS.submissions);

	const { submissions, teamMembersBySubmissionId } =
		await loadSubmissionsFromDb(db, projectId);

	return submissions.map((submission) => {
		if (submission.type === "team") {
			const displayLabel = submission.teamName ?? String(submission.id);
			const memberNames =
				teamMembersBySubmissionId.get(String(submission.id)) ?? [];
			const searchKeys = Array.from(
				new Set(
					[displayLabel, ...memberNames]
						.map(normalizeSearchValue)
						.filter((value) => value.length > 0),
				),
			);

			return {
				id: String(submission.id),
				type: "team",
				teamName: displayLabel,
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
