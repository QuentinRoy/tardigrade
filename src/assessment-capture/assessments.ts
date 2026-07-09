import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import type { AssessmentCriterionValue } from "#criteria/types.ts";
import {
	assessmentForSubmissionCacheTag,
	assessmentForSubmissionQuestionCacheTag,
	assessmentImportCacheTag,
	cacheTags,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
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

// Returns the typed criterion values for a single submission/question assessment.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadQuestionAssessment(
	{
		submissionId,
		projectId,
		questionId,
	}: { submissionId: string; projectId: string; questionId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<AssessmentCriterionValue[]> {
	"use cache";
	cacheTags(...loadAssessmentCacheTags({ submissionId, questionId }));
	cacheLife("values");
	return loadQuestionAssessmentFromDb(db, {
		submissionId,
		projectId,
		questionId,
	});
}

// Returns every question's criterion values for a submission in one query, keyed by
// Question ID. Lets the submission overview load all assessments at once instead
// of issuing one request per question.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadSubmissionAssessments(
	{ submissionId, projectId }: { submissionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Record<string, AssessmentCriterionValue[]>> {
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
): Promise<AssessmentCriterionValue[]> {
	const rows = await loadCriterionAssessmentRows(db, {
		submissionId,
		projectId,
		questionId,
	});

	const values: AssessmentCriterionValue[] = [];
	for (const row of rows) {
		const value = toCriterionValue(row);
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
): Promise<Record<string, AssessmentCriterionValue[]>> {
	const rows = await loadCriterionAssessmentRows(db, {
		submissionId,
		projectId,
	});

	const valuesByQuestionId: Record<string, AssessmentCriterionValue[]> = {};
	for (const row of rows) {
		const value = toCriterionValue(row);
		if (value != null) {
			const values = valuesByQuestionId[row.questionId] ?? [];
			values.push(value);
			valuesByQuestionId[row.questionId] = values;
		}
	}
	return valuesByQuestionId;
}

type CriterionAssessmentRow = {
	questionId: string;
	criterionId: string;
	kind: AssessmentCriterionValue["kind"];
	passed: boolean | null;
	selectedLabel: string | null;
	score: number | string | null;
};

// Loads one row per stored criterion assessment for a submission, optionally scoped
// to a single question. Filtering by Project ID disambiguates submissions and
// questions that share public ids across projects.
async function loadCriterionAssessmentRows(
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
): Promise<CriterionAssessmentRow[]> {
	return db
		.selectFrom("assessment")
		.innerJoin("submission", "submission.id", "assessment.submissionId")
		.innerJoin("project", "project.rowId", "submission.projectId")
		.innerJoin("question", "question.rowId", "assessment.questionId")
		.innerJoin(
			"criterionAssessment",
			"criterionAssessment.assessmentId",
			"assessment.id",
		)
		.innerJoin(
			"criterion",
			"criterion.rowId",
			"criterionAssessment.criterionId",
		)
		.leftJoin(
			"checkCriterionAssessment",
			"checkCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.leftJoin(
			"optionsCriterionAssessment",
			"optionsCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.leftJoin(
			"numberCriterionAssessment",
			"numberCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.where("project.id", "=", projectId)
		.where("submission.id", "=", Number(submissionId))
		.$if(questionId != null, (qb) =>
			qb.where("question.id", "=", nonNull(questionId)),
		)
		.select([
			"question.id as questionId",
			"criterion.id as criterionId",
			"criterionAssessment.kind as kind",
			"checkCriterionAssessment.passed as passed",
			"optionsCriterionAssessment.selectedLabel as selectedLabel",
			"numberCriterionAssessment.score as score",
		])
		.execute();
}

function toCriterionValue(
	row: CriterionAssessmentRow,
): AssessmentCriterionValue | null {
	switch (row.kind) {
		case "check": {
			if (row.passed == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "check",
				passed: row.passed,
			};
		}
		case "options": {
			if (row.selectedLabel == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "options",
				selectedLabel: row.selectedLabel,
			};
		}
		case "number": {
			if (row.score == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "number",
				score:
					typeof row.score === "number"
						? row.score
						: parseFloat(String(row.score)),
			};
		}
		default: {
			return assertNever(row.kind);
		}
	}
}
