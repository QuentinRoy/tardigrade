import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import {
	type AssessmentImportContext,
	type AssessmentImportRubric,
	assessedRubricKey,
	submissionLookupKey,
} from "./prepareAssessmentImport.ts";
import type { ImportedAssessmentRow } from "./types.ts";

async function loadRubricsByColumn(
	db: Kysely<DB>,
	projectRowId: number,
): Promise<Map<string, AssessmentImportRubric>> {
	const rubricRows = await db
		.selectFrom("rubric")
		.innerJoin("question", "question.rowId", "rubric.questionId")
		.leftJoin("ordinalRubric", "ordinalRubric.rubricId", "rubric.rowId")
		.leftJoin(
			"ordinalRubricValue",
			"ordinalRubricValue.ordinalRubricId",
			"ordinalRubric.id",
		)
		.where("rubric.projectId", "=", projectRowId)
		.select([
			"rubric.id",
			"rubric.type",
			"question.id as questionId",
			"ordinalRubricValue.label",
		])
		.execute();

	const rubricsByColumn = new Map<string, AssessmentImportRubric>();

	for (const row of rubricRows) {
		const column = `${row.questionId}:${row.id}`;
		const existing = rubricsByColumn.get(column);

		if (existing == null) {
			rubricsByColumn.set(column, {
				id: row.id,
				type: row.type,
				questionId: row.questionId,
				ordinalLabels: row.label == null ? [] : [row.label],
			});
		} else if (
			row.label != null &&
			!existing.ordinalLabels.includes(row.label)
		) {
			existing.ordinalLabels.push(row.label);
		}
	}

	return rubricsByColumn;
}

async function loadQuestionIds(
	db: Kysely<DB>,
	projectRowId: number,
): Promise<Set<string>> {
	const questions = await db
		.selectFrom("question")
		.where("projectId", "=", projectRowId)
		.select("id")
		.execute();

	return new Set(questions.map((question) => question.id));
}

async function loadSubmissionIdsByLookup(
	db: Kysely<DB>,
	{
		rows,
		projectRowId,
	}: { rows: ImportedAssessmentRow[]; projectRowId: number },
): Promise<Map<string, string[]>> {
	const teamSubmitters = new Set<string>();
	const individualSubmitters = new Set<string>();

	for (const row of rows) {
		if (row.submission_type === "team") {
			teamSubmitters.add(row.submitter);
		} else {
			individualSubmitters.add(row.submitter);
		}
	}

	const [teamSubmissions, individualSubmissions] = await Promise.all([
		teamSubmitters.size > 0
			? db
					.selectFrom("submission")
					.innerJoin("team", "team.id", "submission.teamId")
					.where("submission.type", "=", "team")
					.where("submission.projectId", "=", projectRowId)
					.where("team.name", "in", Array.from(teamSubmitters))
					.select(["team.name as submitter", "submission.id as submissionId"])
					.execute()
			: Promise.resolve([]),
		individualSubmitters.size > 0
			? db
					.selectFrom("submission")
					.innerJoin("student", "student.rowId", "submission.studentId")
					.where("submission.type", "=", "individual")
					.where("submission.projectId", "=", projectRowId)
					.where("student.id", "in", Array.from(individualSubmitters))
					.select(["student.id as submitter", "submission.id as submissionId"])
					.execute()
			: Promise.resolve([]),
	]);

	const submissionIdsByLookup = new Map<string, string[]>();

	function addSubmission(key: string, submissionId: string): void {
		const existing = submissionIdsByLookup.get(key);
		if (existing) {
			existing.push(submissionId);
		} else {
			submissionIdsByLookup.set(key, [submissionId]);
		}
	}

	for (const submission of teamSubmissions) {
		addSubmission(
			submissionLookupKey({
				submissionType: "team",
				submitter: submission.submitter,
			}),
			String(submission.submissionId),
		);
	}

	for (const submission of individualSubmissions) {
		addSubmission(
			submissionLookupKey({
				submissionType: "individual",
				submitter: submission.submitter,
			}),
			String(submission.submissionId),
		);
	}

	return submissionIdsByLookup;
}

async function loadAssessedRubricKeys(
	db: Kysely<DB>,
	projectRowId: number,
): Promise<Set<string>> {
	const assessedPairs = await db
		.selectFrom("rubricAssessment")
		.innerJoin("assessment", "assessment.id", "rubricAssessment.assessmentId")
		.innerJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId")
		.where("assessment.projectId", "=", projectRowId)
		.select(["assessment.submissionId", "rubric.id as rubricId"])
		.execute();

	return new Set(
		assessedPairs.map((pair) =>
			assessedRubricKey({
				submissionId: String(pair.submissionId),
				rubricId: pair.rubricId,
			}),
		),
	);
}

// `db` may be the global client or a caller-supplied transaction. Fetches
// everything prepareAssessmentImport() needs, driven by the parsed rows.
export async function loadAssessmentImportContextFromDb(
	db: Kysely<DB>,
	{ rows, projectId }: { rows: ImportedAssessmentRow[]; projectId: string },
): Promise<AssessmentImportContext> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const [
		rubricsByColumn,
		questionIds,
		submissionIdsByLookup,
		assessedRubricKeys,
	] = await Promise.all([
		loadRubricsByColumn(db, projectRowId),
		loadQuestionIds(db, projectRowId),
		loadSubmissionIdsByLookup(db, { rows, projectRowId }),
		loadAssessedRubricKeys(db, projectRowId),
	]);

	return {
		rubricsByColumn,
		questionIds,
		submissionIdsByLookup,
		assessedRubricKeys,
	};
}
