import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	cacheTags,
	gradeAggregateCacheTag,
	gradeCompletionForRubricCacheTag,
	gradeImportCacheTag,
	gradeTargetListCacheTag,
	rubricListCacheTag,
} from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import {
	buildGradeCompletion,
	type CompletionMetric,
	type GradeCompletionInput,
} from "./gradeCompletion.ts";
import type { GradeCompletionSummary } from "./types.ts";

// Rubric-scoped completion: saving a criterion for rubric Q busts
// `grades:rubric:Q` (and the coarse aggregate), so completion for Q
// refreshes without busting other rubrics; the import tag covers bulk imports,
// and the list tags cover roster and definition changes.
export function gradedCriterionCountsByTargetCacheTags(
	rubricId: string,
): string[] {
	return [
		gradeTargetListCacheTag(),
		rubricListCacheTag(),
		gradeCompletionForRubricCacheTag(rubricId),
		gradeImportCacheTag(),
	];
}

export function gradeCompletionRowsCacheTags(): string[] {
	return [
		gradeTargetListCacheTag(),
		rubricListCacheTag(),
		gradeAggregateCacheTag(),
	];
}

// `db` may be the global client or a caller-supplied transaction.
// Shared rows for `buildGradeCompletion`, scoped to a single project.
export async function loadGradeCompletionRowsFromDb(
	db: Kysely<Database>,
	{ projectId }: { projectId: string },
): Promise<GradeCompletionInput> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [targets, rubrics, gradeCounts] = await Promise.all([
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.projectId", "in", projectRowIdQuery)
			.select("id")
			.execute(),
		db
			.selectFrom("rubric")
			.where("rubric.projectId", "in", projectRowIdQuery)
			.leftJoin("criterion", "criterion.rubricId", "rubric.rowId")
			.select((eb) => [
				"rubric.id as id",
				eb.fn.count<number>("criterion.id").as("criterionCount"),
			])
			.groupBy("rubric.id")
			.execute(),
		db
			.selectFrom("criterionGrade")
			.innerJoin(
				"gradeTarget",
				"gradeTarget.rowId",
				"criterionGrade.gradeTargetRowId",
			)
			.where("gradeTarget.projectId", "in", projectRowIdQuery)
			.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
			.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
			.select((eb) => [
				"gradeTarget.id as targetId",
				"rubric.id as rubricId",
				eb.fn.count<number>("criterionGrade.id").as("gradeCount"),
			])
			.groupBy(["gradeTarget.id", "rubric.id"])
			.execute(),
	]);

	return {
		targetIds: targets.map((target) => target.id),
		rubrics: rubrics.map((rubric) => ({
			id: rubric.id,
			criterionCount: Number(rubric.criterionCount),
		})),
		gradeCounts: gradeCounts.map((row) => ({
			targetId: row.targetId,
			rubricId: row.rubricId,
			gradeCount: Number(row.gradeCount),
		})),
	};
}

// Pure builder: per-target completed/total counts from shared completion rows.
function buildCompletionByTarget(
	rows: GradeCompletionInput,
): Record<string, CompletionMetric> {
	const completion = buildGradeCompletion(rows);

	return Object.fromEntries(
		rows.targetIds.map((targetId) => [
			targetId,
			{
				completed: completion.completedRubricCountByTargetId.get(targetId) ?? 0,
				total: completion.totalRubrics,
			},
		]),
	);
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadGradeCompletionByTargetFromDb(
	db: Kysely<Database>,
	{ projectId }: { projectId: string },
): Promise<Record<string, CompletionMetric>> {
	const rows = await loadGradeCompletionRowsFromDb(db, { projectId });
	return buildCompletionByTarget(rows);
}

// Canonical cached source for project-wide completion rows (Finding 8). Shared by
// `loadGradeCompletionByTarget` and `loadGradeCompletionSummary`, so
// both projections compose one cache entry instead of each querying
// independently.
//
// `options` is forwarded to nothing further; it is the test-only `db` seam
// (ADR 0007 rules 13–14). Runtime callers omit it.
export async function loadGradeCompletionRows(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<Database> },
): Promise<GradeCompletionInput> {
	"use cache";
	cacheTags(...gradeCompletionRowsCacheTags());
	cacheLife("projection");
	return loadGradeCompletionRowsFromDb(options?.db ?? defaultDb, { projectId });
}

// Plain deriver: shares `loadGradeCompletionRows`' cache entry at runtime
// instead of owning a second cache entry for the same underlying data (ADR 0008
// rule 5). `options` is forwarded unchanged (ADR 0007 rule 14): never resolve a
// default here before forwarding, so an omitted `db` stays `undefined` and the
// call shares that wrapper's own no-argument cache entry.
export async function loadGradeCompletionByTarget(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<Database> },
): Promise<Record<string, CompletionMetric>> {
	const rows = await loadGradeCompletionRows({ projectId }, options);
	return buildCompletionByTarget(rows);
}

export type GradedCriterionCounts = {
	totalCriteria: number;
	completedByTargetId: Map<string, number>;
};

// `db` may be the global client or a caller-supplied transaction. Counts only —
// does not load grade target ids, so a caller that already has the project's
// grade targets (for example a page that also renders the roster) can build the
// per-target result from `buildGradedCriterionCountsByTarget` below
// instead of querying grade targets twice (Finding 7).
export async function loadGradedCriterionCountsFromDb(
	db: Kysely<Database>,
	{ rubricId, projectId }: { rubricId: string; projectId: string },
): Promise<GradedCriterionCounts> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [criterionCountRow, gradeCounts] = await Promise.all([
		db
			.selectFrom("criterion")
			.where("criterion.projectId", "in", projectRowIdQuery)
			.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
			.where("rubric.id", "=", rubricId)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow(),
		db
			.selectFrom("criterionGrade")
			.innerJoin(
				"gradeTarget",
				"gradeTarget.rowId",
				"criterionGrade.gradeTargetRowId",
			)
			.where("gradeTarget.projectId", "in", projectRowIdQuery)
			.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
			.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
			.where("rubric.id", "=", rubricId)
			.select((eb) => [
				"gradeTarget.id as targetId",
				eb.fn.count<number>("criterionGrade.id").as("completed"),
			])
			.groupBy("gradeTarget.id")
			.execute(),
	]);

	return {
		totalCriteria: Number(criterionCountRow.count),
		completedByTargetId: new Map(
			gradeCounts.map((row) => [row.targetId, Number(row.completed)]),
		),
	};
}

// Plain wrapper exposing the default db for callers outside `src/`, such as a
// page composing this inside its own `"use cache"` scope (ADR 0007 rule 5).
export async function loadGradedCriterionCounts(
	{ rubricId, projectId }: { rubricId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<GradedCriterionCounts> {
	return loadGradedCriterionCountsFromDb(db, { rubricId, projectId });
}

// Pure builder: per-target completed/total criterion counts for one rubric,
// from already-loaded grade target ids plus the counts above.
export function buildGradedCriterionCountsByTarget(
	targetIds: string[],
	{ totalCriteria, completedByTargetId }: GradedCriterionCounts,
): Record<string, CompletionMetric> {
	return Object.fromEntries(
		targetIds.map((targetId) => {
			const completed = Math.min(
				completedByTargetId.get(targetId) ?? 0,
				totalCriteria,
			);

			return [targetId, { completed, total: totalCriteria }];
		}),
	);
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadGradedCriterionCountsByTargetFromDb(
	db: Kysely<Database>,
	{ rubricId, projectId }: { rubricId: string; projectId: string },
): Promise<Record<string, CompletionMetric>> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [targets, counts] = await Promise.all([
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.projectId", "in", projectRowIdQuery)
			.select("id")
			.execute(),
		loadGradedCriterionCountsFromDb(db, { rubricId, projectId }),
	]);

	return buildGradedCriterionCountsByTarget(
		targets.map((target) => target.id),
		counts,
	);
}

export async function loadGradedCriterionCountsByTarget(
	{ rubricId, projectId }: { rubricId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<Record<string, CompletionMetric>> {
	"use cache";
	cacheTags(...gradedCriterionCountsByTargetCacheTags(rubricId));
	cacheLife("projection");

	return loadGradedCriterionCountsByTargetFromDb(db, { rubricId, projectId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadCriterionGradesCountFromDb(
	db: Kysely<Database>,
	{ projectId }: { projectId: string },
): Promise<number> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const row = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.where("gradeTarget.projectId", "in", projectRowIdQuery)
		.select((eb) => eb.fn.countAll<number>().as("count"))
		.executeTakeFirstOrThrow();

	return Number(row.count);
}

export function criterionGradesCountCacheTags(): string[] {
	return [gradeAggregateCacheTag()];
}

// Canonical cached source for the project-wide criterion-grade count, so the
// uncached project dashboard page (`app/.../[projectSlug]/page.tsx`) doesn't run
// this query on every request even though completion rows are cached.
export async function loadCriterionGradesCount(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<Database> },
): Promise<number> {
	"use cache";
	cacheTags(...criterionGradesCountCacheTags());
	cacheLife("projection");
	return loadCriterionGradesCountFromDb(options?.db ?? defaultDb, {
		projectId,
	});
}

// Pure builder: completion summary from shared completion rows plus the criterion
// grade count.
function buildCompletionSummary(
	rows: GradeCompletionInput,
	criterionGradesCount: number,
): GradeCompletionSummary {
	const completion = buildGradeCompletion(rows);

	const totalCriteriaInProject = rows.rubrics.reduce(
		(sum, rubric) => sum + rubric.criterionCount,
		0,
	);
	const totalExpectedCriterionGrades =
		completion.totalGradeTargets * totalCriteriaInProject;

	return {
		gradeTargets: {
			completed: completion.completedGradeTargets,
			total: completion.totalGradeTargets,
		},
		rubrics: {
			completed: completion.completedRubrics,
			total: completion.totalRubrics,
		},
		criteria: {
			completed: Math.min(criterionGradesCount, totalExpectedCriterionGrades),
			total: totalExpectedCriterionGrades,
		},
	};
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadGradeCompletionSummaryFromDb(
	db: Kysely<Database>,
	{ projectId }: { projectId: string },
): Promise<GradeCompletionSummary> {
	const [rows, criterionGradesCount] = await Promise.all([
		loadGradeCompletionRowsFromDb(db, { projectId }),
		loadCriterionGradesCountFromDb(db, { projectId }),
	]);

	return buildCompletionSummary(rows, criterionGradesCount);
}

// Plain deriver: shares `loadGradeCompletionRows`' cache entry at runtime
// instead of owning a second cache entry for the same underlying data (ADR 0008
// rule 5). `options` is forwarded unchanged (ADR 0007 rule 14): never resolve a
// default here before forwarding, so an omitted `db` stays `undefined` and the
// call shares that wrapper's own no-argument cache entry.
export async function loadGradeCompletionSummary(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<Database> },
): Promise<GradeCompletionSummary> {
	const [rows, criterionGradesCount] = await Promise.all([
		loadGradeCompletionRows({ projectId }, options),
		loadCriterionGradesCount({ projectId }, options),
	]);

	return buildCompletionSummary(rows, criterionGradesCount);
}
