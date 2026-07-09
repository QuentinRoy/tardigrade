import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import type { ImportedAssessmentRow } from "#imports/types.ts";
import {
	type AssessmentImportContext,
	type AssessmentImportCriterion,
	assessedCriterionKey,
	submissionLookupKey,
} from "./prepareAssessmentImport.ts";

async function loadCriteriaByColumn(
	db: Kysely<DB>,
	projectRowId: number,
): Promise<Map<string, AssessmentImportCriterion>> {
	const criterionRows = await db
		.selectFrom("criterion")
		.innerJoin("question", "question.rowId", "criterion.questionId")
		.leftJoin(
			"optionsCriterion",
			"optionsCriterion.criterionId",
			"criterion.rowId",
		)
		.leftJoin(
			"optionsCriterionMark",
			"optionsCriterionMark.optionsCriterionId",
			"optionsCriterion.id",
		)
		.where("criterion.projectId", "=", projectRowId)
		.select([
			"criterion.id",
			"criterion.kind",
			"question.id as questionId",
			"optionsCriterionMark.label",
		])
		.execute();

	const criteriaByColumn = new Map<string, AssessmentImportCriterion>();

	for (const row of criterionRows) {
		const column = `${row.questionId}:${row.id}`;
		const existing = criteriaByColumn.get(column);

		if (existing == null) {
			criteriaByColumn.set(column, {
				id: row.id,
				kind: row.kind,
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

	return criteriaByColumn;
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

async function loadAssessedCriterionKeys(
	db: Kysely<DB>,
	projectRowId: number,
): Promise<Set<string>> {
	const assessedPairs = await db
		.selectFrom("criterionAssessment")
		.innerJoin(
			"assessment",
			"assessment.id",
			"criterionAssessment.assessmentId",
		)
		.innerJoin(
			"criterion",
			"criterion.rowId",
			"criterionAssessment.criterionId",
		)
		.where("assessment.projectId", "=", projectRowId)
		.select(["assessment.submissionId", "criterion.id as criterionId"])
		.execute();

	return new Set(
		assessedPairs.map((pair) =>
			assessedCriterionKey({
				submissionId: String(pair.submissionId),
				criterionId: pair.criterionId,
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
		criteriaByColumn,
		questionIds,
		submissionIdsByLookup,
		assessedCriterionKeys,
	] = await Promise.all([
		loadCriteriaByColumn(db, projectRowId),
		loadQuestionIds(db, projectRowId),
		loadSubmissionIdsByLookup(db, { rows, projectRowId }),
		loadAssessedCriterionKeys(db, projectRowId),
	]);

	return {
		criteriaByColumn,
		questionIds,
		submissionIdsByLookup,
		assessedCriterionKeys,
	};
}
