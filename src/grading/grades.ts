import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import type { CriterionGrade } from "#criteria/types.ts";
import {
	cacheTags,
	gradeForGradeTargetCacheTag,
	gradeForGradeTargetRubricCacheTag,
	gradeImportCacheTag,
} from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { assertNever, nonNull } from "#utils/utils.ts";

export function loadGradeCacheTags({
	targetId,
	rubricId,
}: {
	targetId: string;
	rubricId?: string | undefined;
}) {
	// The granular (or target-scoped) tag refreshes on individual saves;
	// the import tag refreshes on bulk imports.
	const scopeTag =
		rubricId == null
			? gradeForGradeTargetCacheTag(targetId)
			: gradeForGradeTargetRubricCacheTag({ targetId, rubricId });
	return [scopeTag, gradeImportCacheTag()];
}

// Returns the typed criterion values for a single grade-target/rubric grade.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadRubricGrade(
	{
		targetId,
		projectId,
		rubricId,
	}: { targetId: string; projectId: string; rubricId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<CriterionGrade[]> {
	"use cache";
	cacheTags(...loadGradeCacheTags({ targetId, rubricId }));
	cacheLife("values");
	return loadRubricGradeFromDb(db, { targetId, projectId, rubricId });
}

// Returns every rubric's criterion values for a grade target in one query, keyed
// by Rubric ID. Lets the grade-target overview load all grades at once
// instead of issuing one request per rubric.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadGradeTargetGrades(
	{ targetId, projectId }: { targetId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<Record<string, CriterionGrade[]>> {
	"use cache";
	cacheTags(...loadGradeCacheTags({ targetId }));
	cacheLife("values");
	return loadGradeTargetGradesFromDb(db, { targetId, projectId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadRubricGradeFromDb(
	db: Kysely<Database>,
	{
		targetId,
		projectId,
		rubricId,
	}: { targetId: string; projectId: string; rubricId: string },
): Promise<CriterionGrade[]> {
	const rows = await loadCriterionGradeQueryRows(db, {
		targetId,
		projectId,
		rubricId,
	});

	const values: CriterionGrade[] = [];
	for (const row of rows) {
		const value = toCriterionValue(row);
		if (value != null) {
			values.push(value);
		}
	}
	return values;
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadGradeTargetGradesFromDb(
	db: Kysely<Database>,
	{ targetId, projectId }: { targetId: string; projectId: string },
): Promise<Record<string, CriterionGrade[]>> {
	const rows = await loadCriterionGradeQueryRows(db, { targetId, projectId });

	const valuesByRubricId: Record<string, CriterionGrade[]> = {};
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

type CriterionGradeQueryRow = {
	rubricId: string;
	criterionId: string;
	kind: CriterionGrade["kind"];
	passed: boolean | null;
	selectedLabel: string | null;
	score: number | string | null;
};

// Loads one row per stored criterion grade for a grade target, optionally
// scoped to a single rubric. Filtering by Project ID disambiguates grade
// targets and rubrics that share public ids across projects.
async function loadCriterionGradeQueryRows(
	db: Kysely<Database>,
	{
		targetId,
		projectId,
		rubricId,
	}: { targetId: string; projectId: string; rubricId?: string | undefined },
): Promise<CriterionGradeQueryRow[]> {
	return db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.innerJoin("project", "project.rowId", "gradeTarget.projectId")
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
		.where("project.id", "=", projectId)
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
			"numberCriterionGrade.score as score",
		])
		.execute();
}

function toCriterionValue(row: CriterionGradeQueryRow): CriterionGrade | null {
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
