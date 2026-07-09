import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentAggregateCacheTag,
	cacheTags,
	questionListCacheTag,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import {
	loadQuestionRows,
	loadQuestionRowsFromDb,
	type QuestionRow,
	resolveProjectRowId,
	toCriterion,
} from "#questions/questions.ts";
import type { QuestionDefinition } from "./types.ts";

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

export type QuestionDefinitionInput = {
	originalId?: string | undefined;
	id: string;
	label?: string | undefined;
	criteria: CriterionDefinitionInput[];
};

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessmentCountsByQuestionFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<Map<string, number>> {
	const counts = await db
		.selectFrom("assessment")
		.innerJoin("question", "question.rowId", "assessment.questionId")
		.innerJoin("project", "project.rowId", "assessment.projectId")
		.where("project.id", "=", projectId)
		.select(({ fn }) => [
			"question.id as questionId",
			fn.count<number>("assessment.id").as("assessmentCount"),
		])
		.groupBy("question.id")
		.execute();

	return new Map(
		counts.map((count) => [count.questionId, Number(count.assessmentCount)]),
	);
}

function toQuestionDefinitions(
	rows: QuestionRow[],
	assessmentCountByQuestionId: Map<string, number>,
): QuestionDefinition[] {
	return rows.map((row, position) => ({
		id: row.id,
		position,
		assessmentCount: assessmentCountByQuestionId.get(row.id) ?? 0,
		question: {
			label: row.label ?? undefined,
			criteria: row.criteria.map(toCriterion),
		},
	}));
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadQuestionDefinitionsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<QuestionDefinition[]> {
	const [rows, assessmentCountByQuestionId] = await Promise.all([
		loadQuestionRowsFromDb(db, { projectId }),
		loadAssessmentCountsByQuestionFromDb(db, { projectId }),
	]);

	return toQuestionDefinitions(rows, assessmentCountByQuestionId);
}

export function questionDefinitionCacheTags(): string[] {
	return [questionListCacheTag(), assessmentAggregateCacheTag()];
}

// Canonical cached source for the questions-management read (Finding 4). Shares
// `loadQuestionRows`' cache entry for row data (PR6); the assessment-count query
// is composed inside this scope. Counts derive from the coarse `assessments`
// aggregate, busted by every save, so this scope uses the `projection` lifetime
// class rather than `definitions` even though most of what it renders is
// question/criterion structure (ADR 0008 rule 4).
//
// `options` is forwarded to `loadQuestionRows` unchanged (ADR 0007 rule 14): never
// resolve a default here before forwarding, so an omitted `db` stays `undefined`
// and the nested call shares `loadQuestionRows`' own no-argument cache entry.
export async function loadQuestionDefinitions(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<QuestionDefinition[]> {
	"use cache";
	cacheTags(...questionDefinitionCacheTags());
	cacheLife("projection");
	const [rows, assessmentCountByQuestionId] = await Promise.all([
		loadQuestionRows({ projectId }, options),
		loadAssessmentCountsByQuestionFromDb(options?.db ?? defaultDb, {
			projectId,
		}),
	]);

	return toQuestionDefinitions(rows, assessmentCountByQuestionId);
}

// `db` may be the global client or a caller-supplied transaction.
export async function getQuestionDefinitionDeleteImpactFromDb(
	db: Kysely<DB>,
	{ questionId, projectId }: { questionId: string; projectId: string },
): Promise<{ assessmentCount: number }> {
	const projectRowId = await resolveProjectRowId(db, projectId);

	const row = await db
		.selectFrom("assessment")
		.innerJoin("question", "question.rowId", "assessment.questionId")
		.select(({ fn }) => [
			fn.count<number>("assessment.id").as("assessmentCount"),
		])
		.where("question.id", "=", questionId)
		.where("assessment.projectId", "=", projectRowId)
		.executeTakeFirst();

	return { assessmentCount: Number(row?.assessmentCount ?? 0) };
}

export async function getQuestionDefinitionDeleteImpact(
	{ questionId, projectId }: { questionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ assessmentCount: number }> {
	return getQuestionDefinitionDeleteImpactFromDb(db, { questionId, projectId });
}
