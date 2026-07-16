import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import { toCriterionGrade } from "#criteria/criterionGradeHydration.ts";
import type { CriterionGrade } from "#criteria/types.ts";
import {
	allGradesTag,
	allTargetGradesTag,
	allTargetRubricGradesTag,
	cacheTags,
} from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { nonNull } from "#utils/utils.ts";

export function loadGradeCacheTags({
	gridId,
	targetId,
	rubricId,
}: {
	gridId: string;
	targetId: string;
	rubricId?: string | undefined;
}) {
	// The granular (or target-scoped) tag refreshes on individual saves;
	// the coarse grid-wide grades tag refreshes on bulk imports.
	const scopeTag =
		rubricId == null
			? allTargetGradesTag({ gridId, targetId })
			: allTargetRubricGradesTag({ gridId, targetId, rubricId });
	return [scopeTag, allGradesTag({ gridId })];
}

// Returns the typed criterion values for a single grade-target/rubric grade.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadRubricGrade(
	{
		targetId,
		gridId,
		rubricId,
	}: { targetId: string; gridId: string; rubricId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<CriterionGrade[]> {
	"use cache";
	cacheTags(...loadGradeCacheTags({ gridId, targetId, rubricId }));
	cacheLife("values");
	return loadRubricGradeFromDb(db, { targetId, gridId, rubricId });
}

// Returns every rubric's criterion values for a grade target in one query, keyed
// by Rubric ID. Lets the grade-target overview load all grades at once
// instead of issuing one request per rubric.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadGradeTargetGrades(
	{ targetId, gridId }: { targetId: string; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<Record<string, CriterionGrade[]>> {
	"use cache";
	cacheTags(...loadGradeCacheTags({ gridId, targetId }));
	cacheLife("values");
	return loadGradeTargetGradesFromDb(db, { targetId, gridId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadRubricGradeFromDb(
	db: Kysely<Database>,
	{
		targetId,
		gridId,
		rubricId,
	}: { targetId: string; gridId: string; rubricId: string },
): Promise<CriterionGrade[]> {
	const rows = await loadCriterionGradeQueryRows(db, {
		targetId,
		gridId,
		rubricId,
	});

	const grades: CriterionGrade[] = [];
	for (const row of rows) {
		const grade = toCriterionGrade(row);
		if (grade != null) {
			grades.push(grade);
		}
	}
	return grades;
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadGradeTargetGradesFromDb(
	db: Kysely<Database>,
	{ targetId, gridId }: { targetId: string; gridId: string },
): Promise<Record<string, CriterionGrade[]>> {
	const rows = await loadCriterionGradeQueryRows(db, { targetId, gridId });

	const gradesByRubricId: Record<string, CriterionGrade[]> = {};
	for (const row of rows) {
		const grade = toCriterionGrade(row);
		if (grade != null) {
			const grades = gradesByRubricId[row.rubricId] ?? [];
			grades.push(grade);
			gradesByRubricId[row.rubricId] = grades;
		}
	}
	return gradesByRubricId;
}

type CriterionGradeQueryRow = {
	rubricId: string;
	criterionId: string;
	kind: CriterionGrade["kind"];
	passed: boolean | null;
	selectedLabel: string | null;
	value: number | string | null;
};

// Loads one row per stored criterion grade for a grade target, optionally
// scoped to a single rubric. Filtering by Grid ID disambiguates grade
// targets and rubrics that share public ids across grids.
async function loadCriterionGradeQueryRows(
	db: Kysely<Database>,
	{
		targetId,
		gridId,
		rubricId,
	}: { targetId: string; gridId: string; rubricId?: string | undefined },
): Promise<CriterionGradeQueryRow[]> {
	return db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.innerJoin("grid", "grid.rowId", "gradeTarget.gridRowId")
		.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
		.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
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
		.where("grid.id", "=", gridId)
		.where("gradeTarget.id", "=", targetId)
		.$if(rubricId != null, (qb) =>
			qb.where("rubric.id", "=", nonNull(rubricId)),
		)
		.select([
			"rubric.id as rubricId",
			"criterion.id as criterionId",
			"criterion.kind as kind",
			"checkCriterionGrade.passed as passed",
			"optionsCriterionGrade.selectedLabel as selectedLabel",
			"numberCriterionGrade.value as value",
		])
		.execute();
}
