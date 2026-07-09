import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentAggregateCacheTag,
	cacheTags,
	rubricListCacheTag,
	submissionListCacheTag,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { loadRubricsById } from "#rubrics/rubrics.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import {
	buildResultsData,
	type ResultsAssessmentRecord,
	type ResultsData,
} from "./resultsBuilder.ts";

export function resultsCacheTags(): string[] {
	return [
		rubricListCacheTag(),
		submissionListCacheTag(),
		assessmentAggregateCacheTag(),
	];
}

// `db` may be the global client or a caller-supplied transaction. The only
// results-specific, schema-sensitive query: the three-way leftJoin across the
// check/options/number assessment subtype tables.
export async function loadCriterionAssessmentRecordsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<ResultsAssessmentRecord[]> {
	return db
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
		.where(
			"assessment.projectId",
			"in",
			db.selectFrom("project").select("rowId").where("id", "=", projectId),
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
		.select([
			"assessment.submissionId as gradeTargetId",
			"criterion.id as criterionId",
			"criterionAssessment.kind as kind",
			"checkCriterionAssessment.passed as passed",
			"optionsCriterionAssessment.selectedLabel as selectedLabel",
			"numberCriterionAssessment.score as score",
		])
		.execute();
}

// Composes the cached `loadSubmissions`/`loadRubricsById` wrappers (Design B:
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

	const [submissions, rubricsById, assessmentRecords] = await Promise.all([
		loadSubmissions({ projectId }, options),
		loadRubricsById({ projectId }, options),
		loadCriterionAssessmentRecordsFromDb(options?.db ?? defaultDb, {
			projectId,
		}),
	]);

	return buildResultsData({ submissions, rubricsById, assessmentRecords });
}
