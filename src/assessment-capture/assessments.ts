import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentForSubmissionCacheTag,
	assessmentForSubmissionQuestionCacheTag,
	assessmentImportCacheTag,
	cacheTags,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import type { AssessmentRubricValue } from "#rubrics/types.ts";
import { assertNever, nonNull } from "#utils/utils.ts";

export function loadAssessmentCacheTags({
	submissionId,
	questionId,
}: {
	submissionId: string;
	questionId?: string | undefined;
}) {
	// The granular (or submission-scoped) tag refreshes on individual saves;
	// the import tag refreshes on bulk imports.
	const scopeTag =
		questionId == null
			? assessmentForSubmissionCacheTag(submissionId)
			: assessmentForSubmissionQuestionCacheTag({ submissionId, questionId });
	return [scopeTag, assessmentImportCacheTag()];
}

// Returns the typed rubric values for a single submission/question assessment.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadQuestionAssessment(
	{
		submissionId,
		projectId,
		questionId,
	}: { submissionId: string; projectId: string; questionId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<AssessmentRubricValue[]> {
	"use cache";
	cacheTags(...loadAssessmentCacheTags({ submissionId, questionId }));
	cacheLife("values");
	return loadQuestionAssessmentFromDb(db, {
		submissionId,
		projectId,
		questionId,
	});
}

// Returns every question's rubric values for a submission in one query, keyed by
// Question ID. Lets the submission overview load all assessments at once instead
// of issuing one request per question.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadSubmissionAssessments(
	{ submissionId, projectId }: { submissionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Record<string, AssessmentRubricValue[]>> {
	"use cache";
	cacheTags(...loadAssessmentCacheTags({ submissionId }));
	cacheLife("values");
	return loadSubmissionAssessmentsFromDb(db, { submissionId, projectId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadQuestionAssessmentFromDb(
	db: Kysely<DB>,
	{
		submissionId,
		projectId,
		questionId,
	}: { submissionId: string; projectId: string; questionId: string },
): Promise<AssessmentRubricValue[]> {
	const rows = await loadRubricAssessmentRows(db, {
		submissionId,
		projectId,
		questionId,
	});

	const values: AssessmentRubricValue[] = [];
	for (const row of rows) {
		const value = toRubricValue(row);
		if (value != null) {
			values.push(value);
		}
	}
	return values;
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadSubmissionAssessmentsFromDb(
	db: Kysely<DB>,
	{ submissionId, projectId }: { submissionId: string; projectId: string },
): Promise<Record<string, AssessmentRubricValue[]>> {
	const rows = await loadRubricAssessmentRows(db, { submissionId, projectId });

	const valuesByQuestionId: Record<string, AssessmentRubricValue[]> = {};
	for (const row of rows) {
		const value = toRubricValue(row);
		if (value != null) {
			const values = valuesByQuestionId[row.questionId] ?? [];
			values.push(value);
			valuesByQuestionId[row.questionId] = values;
		}
	}
	return valuesByQuestionId;
}

type RubricAssessmentRow = {
	questionId: string;
	rubricId: string;
	type: AssessmentRubricValue["type"];
	passed: boolean | null;
	selectedLabel: string | null;
	score: number | string | null;
};

// Loads one row per stored rubric assessment for a submission, optionally scoped
// to a single question. Filtering by Project ID disambiguates submissions and
// questions that share public ids across projects.
async function loadRubricAssessmentRows(
	db: Kysely<DB>,
	{
		submissionId,
		projectId,
		questionId,
	}: {
		submissionId: string;
		projectId: string;
		questionId?: string | undefined;
	},
): Promise<RubricAssessmentRow[]> {
	return db
		.selectFrom("assessment")
		.innerJoin("submission", "submission.id", "assessment.submissionId")
		.innerJoin("project", "project.rowId", "submission.projectId")
		.innerJoin("question", "question.rowId", "assessment.questionId")
		.innerJoin(
			"rubricAssessment",
			"rubricAssessment.assessmentId",
			"assessment.id",
		)
		.innerJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId")
		.leftJoin(
			"booleanRubricAssessment",
			"booleanRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.leftJoin(
			"ordinalRubricAssessment",
			"ordinalRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.leftJoin(
			"numericalRubricAssessment",
			"numericalRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.where("project.id", "=", projectId)
		.where("submission.id", "=", Number(submissionId))
		.$if(questionId != null, (qb) =>
			qb.where("question.id", "=", nonNull(questionId)),
		)
		.select([
			"question.id as questionId",
			"rubric.id as rubricId",
			"rubricAssessment.type as type",
			"booleanRubricAssessment.passed as passed",
			"ordinalRubricAssessment.selectedLabel as selectedLabel",
			"numericalRubricAssessment.score as score",
		])
		.execute();
}

function toRubricValue(row: RubricAssessmentRow): AssessmentRubricValue | null {
	switch (row.type) {
		case "boolean": {
			if (row.passed == null) {
				return null;
			}
			return { rubricId: row.rubricId, type: "boolean", passed: row.passed };
		}
		case "ordinal": {
			if (row.selectedLabel == null) {
				return null;
			}
			return {
				rubricId: row.rubricId,
				type: "ordinal",
				selectedLabel: row.selectedLabel,
			};
		}
		case "numerical": {
			if (row.score == null) {
				return null;
			}
			return {
				rubricId: row.rubricId,
				type: "numerical",
				score:
					typeof row.score === "number"
						? row.score
						: parseFloat(String(row.score)),
			};
		}
		default: {
			return assertNever(row.type);
		}
	}
}
