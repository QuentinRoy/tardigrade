import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentAggregateCacheTag,
	cacheTags,
	rubricListCacheTag,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import {
	loadRubricRows,
	loadRubricRowsFromDb,
	type RubricRow,
	resolveProjectRowId,
	toCriterion,
} from "#rubrics/rubrics.ts";
import type { RubricDefinition } from "./types.ts";

export type CriterionDefinitionInput =
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			kind: "check";
			marks: number;
			falseMarks?: number | undefined;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			kind: "options";
			marks: Record<string, number>;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			kind: "number";
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

export type RubricDefinitionInput = {
	originalId?: string | undefined;
	id: string;
	label?: string | undefined;
	criteria: CriterionDefinitionInput[];
};

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessmentCountsByRubricFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<Map<string, number>> {
	const counts = await db
		.selectFrom("assessment")
		.innerJoin("rubric", "rubric.rowId", "assessment.rubricId")
		.innerJoin("project", "project.rowId", "assessment.projectId")
		.where("project.id", "=", projectId)
		.select(({ fn }) => [
			"rubric.id as rubricId",
			fn.count<number>("assessment.id").as("assessmentCount"),
		])
		.groupBy("rubric.id")
		.execute();

	return new Map(
		counts.map((count) => [count.rubricId, Number(count.assessmentCount)]),
	);
}

function toRubricDefinitions(
	rows: RubricRow[],
	assessmentCountByRubricId: Map<string, number>,
): RubricDefinition[] {
	return rows.map((row, position) => ({
		id: row.id,
		position,
		assessmentCount: assessmentCountByRubricId.get(row.id) ?? 0,
		rubric: {
			label: row.label ?? undefined,
			criteria: row.criteria.map(toCriterion),
		},
	}));
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadRubricDefinitionsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<RubricDefinition[]> {
	const [rows, assessmentCountByRubricId] = await Promise.all([
		loadRubricRowsFromDb(db, { projectId }),
		loadAssessmentCountsByRubricFromDb(db, { projectId }),
	]);

	return toRubricDefinitions(rows, assessmentCountByRubricId);
}

export function rubricDefinitionCacheTags(): string[] {
	return [rubricListCacheTag(), assessmentAggregateCacheTag()];
}

// Canonical cached source for the rubrics-management read (Finding 4). Shares
// `loadRubricRows`' cache entry for row data (PR6); the assessment-count query
// is composed inside this scope. Counts derive from the coarse `assessments`
// aggregate, busted by every save, so this scope uses the `projection` lifetime
// class rather than `definitions` even though most of what it renders is
// rubric/criterion structure (ADR 0008 rule 4).
//
// `options` is forwarded to `loadRubricRows` unchanged (ADR 0007 rule 14): never
// resolve a default here before forwarding, so an omitted `db` stays `undefined`
// and the nested call shares `loadRubricRows`' own no-argument cache entry.
export async function loadRubricDefinitions(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<RubricDefinition[]> {
	"use cache";
	cacheTags(...rubricDefinitionCacheTags());
	cacheLife("projection");
	const [rows, assessmentCountByRubricId] = await Promise.all([
		loadRubricRows({ projectId }, options),
		loadAssessmentCountsByRubricFromDb(options?.db ?? defaultDb, { projectId }),
	]);

	return toRubricDefinitions(rows, assessmentCountByRubricId);
}

// `db` may be the global client or a caller-supplied transaction.
export async function getRubricDefinitionDeleteImpactFromDb(
	db: Kysely<DB>,
	{ rubricId, projectId }: { rubricId: string; projectId: string },
): Promise<{ assessmentCount: number }> {
	const projectRowId = await resolveProjectRowId(db, projectId);

	const row = await db
		.selectFrom("assessment")
		.innerJoin("rubric", "rubric.rowId", "assessment.rubricId")
		.select(({ fn }) => [
			fn.count<number>("assessment.id").as("assessmentCount"),
		])
		.where("rubric.id", "=", rubricId)
		.where("assessment.projectId", "=", projectRowId)
		.executeTakeFirst();

	return { assessmentCount: Number(row?.assessmentCount ?? 0) };
}

export async function getRubricDefinitionDeleteImpact(
	{ rubricId, projectId }: { rubricId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ assessmentCount: number }> {
	return getRubricDefinitionDeleteImpactFromDb(db, { rubricId, projectId });
}
