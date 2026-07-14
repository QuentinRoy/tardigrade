import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	cacheTags,
	gradeAggregateCacheTag,
	gradeTargetListCacheTag,
	rubricListCacheTag,
} from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";
import { loadRubricsById } from "#rubrics/rubrics.ts";
import {
	buildResultsData,
	type ResultsData,
	type ResultsGradeRecord,
} from "./resultsBuilder.ts";

export function resultsCacheTags(): string[] {
	return [
		rubricListCacheTag(),
		gradeTargetListCacheTag(),
		gradeAggregateCacheTag(),
	];
}

// `db` may be the global client or a caller-supplied transaction. The only
// results-specific, schema-sensitive query: the three-way leftJoin across the
// check/options/number grade subtype tables.
export async function loadCriterionGradeRecordsFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
): Promise<ResultsGradeRecord[]> {
	return db
		.selectFrom("criterionGrade")
		.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.where(
			"gradeTarget.gridRowId",
			"in",
			db.selectFrom("grid").select("rowId").where("id", "=", gridId),
		)
		.leftJoin(
			"checkCriterionGrade",
			"checkCriterionGrade.criterionGradeId",
			"criterionGrade.id",
		)
		.leftJoin(
			"optionsCriterionGrade",
			"optionsCriterionGrade.criterionGradeId",
			"criterionGrade.id",
		)
		.leftJoin(
			"numberCriterionGrade",
			"numberCriterionGrade.criterionGradeId",
			"criterionGrade.id",
		)
		.select([
			"gradeTarget.id as gradeTargetId",
			"criterion.id as criterionId",
			"criterion.kind as kind",
			"checkCriterionGrade.passed as passed",
			"optionsCriterionGrade.selectedLabel as selectedLabel",
			"numberCriterionGrade.score as score",
		])
		.execute();
}

// Composes the cached `loadGradeTargets`/`loadRubricsById` wrappers (Design B:
// only the grade-record query above is results-specific) so their cache
// entries stay shared rather than duplicated here (ADR 0008 rule 5).
// `options` is forwarded unchanged (ADR 0007 rule 14): never resolve a default
// here before forwarding, so an omitted `db` stays `undefined` for those calls.
export async function loadResultsData(
	{ gridId }: { gridId: string },
	options?: { db?: Kysely<Database> },
): Promise<ResultsData> {
	"use cache";
	cacheTags(...resultsCacheTags());
	cacheLife("projection");

	const [targets, rubricsById, gradeRecords] = await Promise.all([
		loadGradeTargets({ gridId }, options),
		loadRubricsById({ gridId }, options),
		loadCriterionGradeRecordsFromDb(options?.db ?? defaultDb, { gridId }),
	]);

	return buildResultsData({ targets, rubricsById, gradeRecords });
}
