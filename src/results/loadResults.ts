import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentAggregateCacheTag,
	cacheTags,
	gradeTargetListCacheTag,
	rubricListCacheTag,
} from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import { loadRubricsById } from "#rubrics/rubrics.ts";
import {
	buildResultsData,
	type ResultsAssessmentRecord,
	type ResultsData,
} from "./resultsBuilder.ts";

export function resultsCacheTags(): string[] {
	return [
		rubricListCacheTag(),
		gradeTargetListCacheTag(),
		assessmentAggregateCacheTag(),
	];
}

// `db` may be the global client or a caller-supplied transaction. The only
// results-specific, schema-sensitive query: the three-way leftJoin across the
// check/options/number assessment subtype tables.
export async function loadCriterionAssessmentRecordsFromDb(
	db: Kysely<Database>,
	{ projectId }: { projectId: string },
): Promise<ResultsAssessmentRecord[]> {
	return db
		.selectFrom("criterionAssessment")
		.innerJoin(
			"criterion",
			"criterion.rowId",
			"criterionAssessment.criterionId",
		)
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionAssessment.gradeTargetRowId",
		)
		.where(
			"gradeTarget.projectId",
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
			"gradeTarget.id as gradeTargetId",
			"criterion.id as criterionId",
			"criterion.kind as kind",
			"checkCriterionAssessment.passed as passed",
			"optionsCriterionAssessment.selectedLabel as selectedLabel",
			"numberCriterionAssessment.score as score",
		])
		.execute();
}

// Composes the cached `loadGradeTargets`/`loadRubricsById` wrappers (Design B:
// only the assessment-record query above is results-specific) so their cache
// entries stay shared rather than duplicated here (ADR 0008 rule 5).
// `options` is forwarded unchanged (ADR 0007 rule 14): never resolve a default
// here before forwarding, so an omitted `db` stays `undefined` for those calls.
export async function loadResultsData(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<Database> },
): Promise<ResultsData> {
	"use cache";
	cacheTags(...resultsCacheTags());
	cacheLife("projection");

	const [targets, rubricsById, assessmentRecords] = await Promise.all([
		loadGradeTargets({ projectId }, options),
		loadRubricsById({ projectId }, options),
		loadCriterionAssessmentRecordsFromDb(options?.db ?? defaultDb, {
			projectId,
		}),
	]);

	return buildResultsData({ targets, rubricsById, assessmentRecords });
}
