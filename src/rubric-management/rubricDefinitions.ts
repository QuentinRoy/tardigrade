import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import type { CheckCriterionEditorValue } from "#criteria/check/checkSchemas.ts";
import type { NumberCriterionEditorValue } from "#criteria/number/numberSchemas.ts";
import type { OptionsCriterionEditorValue } from "#criteria/options/optionsSchemas.ts";
import { allGradesTag, allRubricsTag, cacheTags } from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import {
	loadRubricRows,
	loadRubricRowsFromDb,
	type RubricRow,
	resolveGridRowId,
	toCriterion,
} from "#rubrics/rubrics.ts";
import type { RubricDefinition } from "./types.ts";

export type CriterionDefinitionInput =
	| CheckCriterionEditorValue
	| OptionsCriterionEditorValue
	| NumberCriterionEditorValue;

export type RubricDefinitionInput = {
	originalId?: string | undefined;
	id: string;
	label?: string | undefined;
	criteria: CriterionDefinitionInput[];
};

// `db` may be the global client or a caller-supplied transaction.
export async function loadGradeCountsByRubricFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
): Promise<Map<string, number>> {
	const counts = await db
		.selectFrom("criterionGrade")
		.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
		.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
		.innerJoin("grid", "grid.rowId", "rubric.gridRowId")
		.where("grid.id", "=", gridId)
		.select(({ fn }) => [
			"rubric.id as rubricId",
			fn
				.count<number>("criterionGrade.gradeTargetRowId")
				.distinct()
				.as("gradedTargetCount"),
		])
		.groupBy("rubric.id")
		.execute();

	return new Map(
		counts.map((count) => [count.rubricId, Number(count.gradedTargetCount)]),
	);
}

function toRubricDefinitions(
	rows: RubricRow[],
	gradeCountByRubricId: Map<string, number>,
): RubricDefinition[] {
	return rows.map((row, position) => ({
		id: row.id,
		position,
		gradedTargetCount: gradeCountByRubricId.get(row.id) ?? 0,
		rubric: {
			label: row.label ?? undefined,
			criteria: row.criteria.map(toCriterion),
		},
	}));
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadRubricDefinitionsFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
): Promise<RubricDefinition[]> {
	const [rows, gradeCountByRubricId] = await Promise.all([
		loadRubricRowsFromDb(db, { gridId }),
		loadGradeCountsByRubricFromDb(db, { gridId }),
	]);

	return toRubricDefinitions(rows, gradeCountByRubricId);
}

export function rubricDefinitionCacheTags({
	gridId,
}: {
	gridId: string;
}): string[] {
	return [allRubricsTag({ gridId }), allGradesTag({ gridId })];
}

// Canonical cached source for the rubrics-management read (Finding 4). Shares
// `loadRubricRows`' cache entry for row data (PR6); the grade-count query
// is composed inside this scope. Counts derive from the coarse `grades`
// aggregate, busted by every save, so this scope uses the `projection` lifetime
// class rather than `definitions` even though most of what it renders is
// rubric/criterion structure (ADR 0008 rule 4).
//
// `options` is forwarded to `loadRubricRows` unchanged (ADR 0007 rule 14): never
// resolve a default here before forwarding, so an omitted `db` stays `undefined`
// and the nested call shares `loadRubricRows`' own no-argument cache entry.
export async function loadRubricDefinitions(
	{ gridId }: { gridId: string },
	options?: { db?: Kysely<Database> },
): Promise<RubricDefinition[]> {
	"use cache";
	cacheTags(...rubricDefinitionCacheTags({ gridId }));
	cacheLife("projection");
	const [rows, gradeCountByRubricId] = await Promise.all([
		loadRubricRows({ gridId }, options),
		loadGradeCountsByRubricFromDb(options?.db ?? defaultDb, { gridId }),
	]);

	return toRubricDefinitions(rows, gradeCountByRubricId);
}

// `db` may be the global client or a caller-supplied transaction.
export async function getRubricDefinitionDeleteImpactFromDb(
	db: Kysely<Database>,
	{ rubricId, gridId }: { rubricId: string; gridId: string },
): Promise<{ gradedTargetCount: number }> {
	const gridRowId = await resolveGridRowId(db, gridId);

	const row = await db
		.selectFrom("criterionGrade")
		.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
		.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
		.select(({ fn }) => [
			fn
				.count<number>("criterionGrade.gradeTargetRowId")
				.distinct()
				.as("gradedTargetCount"),
		])
		.where("rubric.id", "=", rubricId)
		.where("rubric.gridRowId", "=", gridRowId)
		.executeTakeFirst();

	return { gradedTargetCount: Number(row?.gradedTargetCount ?? 0) };
}

export async function getRubricDefinitionDeleteImpact(
	{ rubricId, gridId }: { rubricId: string; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<{ gradedTargetCount: number }> {
	return getRubricDefinitionDeleteImpactFromDb(db, { rubricId, gridId });
}
