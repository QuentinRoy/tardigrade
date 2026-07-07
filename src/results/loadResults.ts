import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentAggregateCacheTag,
	cacheTags,
	questionListCacheTag,
	submissionListCacheTag,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { loadQuestionGrid } from "#questions/questions.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import {
	buildResultsData,
	type ResultsAssessmentRecord,
	type ResultsData,
} from "./resultsBuilder.ts";

export function resultsCacheTags(): string[] {
	return [
		questionListCacheTag(),
		submissionListCacheTag(),
		assessmentAggregateCacheTag(),
	];
}

// `db` may be the global client or a caller-supplied transaction. The only
// results-specific, schema-sensitive query: the three-way leftJoin across the
// boolean/ordinal/numerical assessment subtype tables.
export async function loadCriterionAssessmentRecordsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<ResultsAssessmentRecord[]> {
	return db
		.selectFrom("rubricAssessment")
		.innerJoin("assessment", "assessment.id", "rubricAssessment.assessmentId")
		.innerJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId")
		.where(
			"assessment.projectId",
			"in",
			db.selectFrom("project").select("rowId").where("id", "=", projectId),
		)
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
		.select([
			"assessment.submissionId as gradeTargetId",
			"rubric.id as criterionId",
			"rubricAssessment.type as type",
			"booleanRubricAssessment.passed as passed",
			"ordinalRubricAssessment.selectedLabel as selectedLabel",
			"numericalRubricAssessment.score as score",
		])
		.execute();
}

// Composes the cached `loadSubmissions`/`loadQuestionGrid` wrappers (Design B:
// only the assessment-record query above is results-specific) so their cache
// entries stay shared rather than duplicated here (ADR 0008 rule 5).
// `options` is forwarded unchanged (ADR 0007 rule 14): never resolve a default
// here before forwarding, so an omitted `db` stays `undefined` for those calls.
export async function loadResultsData(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<ResultsData> {
	"use cache";
	cacheTags(...resultsCacheTags());
	cacheLife("projection");

	const [submissions, questionGrid, assessmentRecords] = await Promise.all([
		loadSubmissions({ projectId }, options),
		loadQuestionGrid({ projectId }, options),
		loadCriterionAssessmentRecordsFromDb(options?.db ?? defaultDb, {
			projectId,
		}),
	]);

	return buildResultsData({ submissions, questionGrid, assessmentRecords });
}
