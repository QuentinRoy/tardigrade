import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import type { AssessmentCriterionValue } from "#criteria/types.ts";
import {
	assessmentForSubmissionCacheTag,
	assessmentForSubmissionRubricCacheTag,
	assessmentImportCacheTag,
	cacheTags,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { assertNever, nonNull } from "#utils/utils.ts";

export function loadAssessmentCacheTags({
	submissionId,
	rubricId,
}: {
	submissionId: string;
	rubricId?: string | undefined;
}) {
	// The granular (or submission-scoped) tag refreshes on individual saves;
	// the import tag refreshes on bulk imports.
	const scopeTag =
		rubricId == null
			? assessmentForSubmissionCacheTag(submissionId)
			: assessmentForSubmissionRubricCacheTag({ submissionId, rubricId });
	return [scopeTag, assessmentImportCacheTag()];
}

// Returns the typed criterion values for a single submission/rubric assessment.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadRubricAssessment(
	{
		submissionId,
		projectId,
		rubricId,
	}: { submissionId: string; projectId: string; rubricId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<AssessmentCriterionValue[]> {
	"use cache";
	cacheTags(...loadAssessmentCacheTags({ submissionId, rubricId }));
	cacheLife("values");
	return loadRubricAssessmentFromDb(db, { submissionId, projectId, rubricId });
}

// Returns every rubric's criterion values for a submission in one query, keyed by
// Rubric ID. Lets the submission overview load all assessments at once instead
// of issuing one request per rubric.
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
export async function loadRubricAssessmentFromDb(
	db: Kysely<DB>,
	{
		submissionId,
		projectId,
		rubricId,
	}: { submissionId: string; projectId: string; rubricId: string },
): Promise<AssessmentCriterionValue[]> {
	const rows = await loadCriterionAssessmentRows(db, {
		submissionId,
		projectId,
		rubricId,
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

	const valuesByRubricId: Record<string, AssessmentCriterionValue[]> = {};
	for (const row of rows) {
		const value = toCriterionValue(row);
		if (value != null) {
			const values = valuesByRubricId[row.rubricId] ?? [];
			values.push(value);
			valuesByRubricId[row.rubricId] = values;
		}
	}
	return valuesByRubricId;
}

type CriterionAssessmentRow = {
	rubricId: string;
	criterionId: string;
	kind: AssessmentCriterionValue["kind"];
	passed: boolean | null;
	selectedLabel: string | null;
	score: number | string | null;
};

// Loads one row per stored criterion assessment for a submission, optionally scoped
// to a single rubric. Filtering by Project ID disambiguates submissions and
// rubrics that share public ids across projects.
async function loadCriterionAssessmentRows(
	db: Kysely<DB>,
	{
		submissionId,
		projectId,
		rubricId,
	}: { submissionId: string; projectId: string; rubricId?: string | undefined },
): Promise<CriterionAssessmentRow[]> {
	return db
		.selectFrom("assessment")
		.innerJoin("submission", "submission.id", "assessment.submissionId")
		.innerJoin("project", "project.rowId", "submission.projectId")
		.innerJoin("rubric", "rubric.rowId", "assessment.rubricId")
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
		.$if(rubricId != null, (qb) =>
			qb.where("rubric.id", "=", nonNull(rubricId)),
		)
		.select([
			"rubric.id as rubricId",
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
