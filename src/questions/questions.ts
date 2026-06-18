import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import { cacheTags, questionListCacheTag } from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import type { Rubric, RubricType } from "#rubrics/types.ts";
import type { Grid, Question } from "./types.ts";

export function toNumber(value: string | number): number {
	if (typeof value === "number") return value;
	return parseFloat(value);
}

export function toRubric(data: {
	id: string;
	type: RubricType;
	description: string | null;
	label: string | null;
	booleanRubric: { marks: number; falseMarks: number } | null;
	ordinalRubric: { marks: { label: string; marks: number }[] } | null;
	numericalRubric: {
		minScore: number;
		maxScore: number;
		minMarks: number;
		maxMarks: number;
		reversed: boolean;
	} | null;
}): Rubric {
	if (data.type === "ordinal") {
		if (data.ordinalRubric == null) {
			throw new Error(
				`Rubric Subtype Invariant violation: missing ordinalRubric row for rubric ${data.id}.`,
			);
		}
		return {
			id: data.id,
			description: data.description ?? undefined,
			label: data.label ?? undefined,
			type: "ordinal",
			marks: Object.fromEntries(
				data.ordinalRubric.marks.map((item) => [
					item.label,
					toNumber(item.marks),
				]),
			),
		};
	}

	if (data.type === "numerical") {
		if (data.numericalRubric == null) {
			throw new Error(
				`Rubric Subtype Invariant violation: missing numericalRubric row for rubric ${data.id}.`,
			);
		}
		return {
			id: data.id,
			description: data.description ?? undefined,
			label: data.label ?? undefined,
			type: "numerical",
			minScore: toNumber(data.numericalRubric.minScore),
			maxScore: toNumber(data.numericalRubric.maxScore),
			minMarks: toNumber(data.numericalRubric.minMarks),
			maxMarks: toNumber(data.numericalRubric.maxMarks),
			reversed: data.numericalRubric.reversed,
		};
	}

	if (data.booleanRubric == null) {
		throw new Error(
			`Rubric Subtype Invariant violation: missing booleanRubric row for rubric ${data.id}.`,
		);
	}
	return {
		id: data.id,
		description: data.description ?? undefined,
		label: data.label ?? undefined,
		type: "boolean",
		marks: toNumber(data.booleanRubric.marks),
		falseMarks: toNumber(data.booleanRubric.falseMarks),
	};
}

export type QuestionRow = {
	id: string;
	label: string | null;
	rubrics: {
		id: string;
		type: RubricType;
		description: string | null;
		label: string | null;
		booleanRubric: { marks: number; falseMarks: number } | null;
		ordinalRubric: { marks: { label: string; marks: number }[] } | null;
		numericalRubric: {
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
		} | null;
	}[];
};

// `db` may be the global client or a caller-supplied transaction
// (a `Transaction<DB>` is a `Kysely<DB>`), so this composes inside a caller's tx.
export async function resolveProjectRowId(
	db: Kysely<DB>,
	projectId: string,
): Promise<number> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();

	return project.rowId;
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadQuestionRowsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<QuestionRow[]> {
	const projectRowId = await resolveProjectRowId(db, projectId);

	const [questions, rubrics, booleanRubrics, numericalRubrics, ordinalMarks] =
		await Promise.all([
			db
				.selectFrom("question")
				.where("question.projectId", "=", projectRowId)
				.select(["id", "label", "position"])
				.orderBy("position", "asc")
				.execute(),
			db
				.selectFrom("rubric")
				.innerJoin("question", "question.rowId", "rubric.questionId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as id",
					"question.id as questionId",
					"rubric.position as position",
					"rubric.description as description",
					"rubric.label as label",
					"rubric.type as type",
				])
				.orderBy("rubric.position", "asc")
				.execute(),
			db
				.selectFrom("booleanRubric")
				.innerJoin("rubric", "rubric.rowId", "booleanRubric.rubricId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as rubricId",
					"booleanRubric.marks as marks",
					"booleanRubric.falseMarks as falseMarks",
				])
				.execute(),
			db
				.selectFrom("numericalRubric")
				.innerJoin("rubric", "rubric.rowId", "numericalRubric.rubricId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as rubricId",
					"numericalRubric.minScore as minScore",
					"numericalRubric.maxScore as maxScore",
					"numericalRubric.minMarks as minMarks",
					"numericalRubric.maxMarks as maxMarks",
					"numericalRubric.reversed as reversed",
				])
				.execute(),
			db
				.selectFrom("ordinalRubric")
				.leftJoin(
					"ordinalRubricValue",
					"ordinalRubricValue.ordinalRubricId",
					"ordinalRubric.id",
				)
				.innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as rubricId",
					"ordinalRubricValue.label as label",
					"ordinalRubricValue.marks as marks",
				])
				.orderBy("ordinalRubricValue.marks", "desc")
				.orderBy("ordinalRubricValue.label", "asc")
				.execute(),
		]);

	const booleanRubricById = new Map(
		booleanRubrics.map((row) => [
			row.rubricId,
			{ marks: toNumber(row.marks), falseMarks: toNumber(row.falseMarks) },
		]),
	);

	const numericalRubricById = new Map(
		numericalRubrics.map((row) => [
			row.rubricId,
			{
				minScore: toNumber(row.minScore),
				maxScore: toNumber(row.maxScore),
				minMarks: toNumber(row.minMarks),
				maxMarks: toNumber(row.maxMarks),
				reversed: row.reversed,
			},
		]),
	);

	const ordinalMarksByRubricId = new Map<
		string,
		{ label: string; marks: number }[]
	>();
	for (const row of ordinalMarks) {
		const list = ordinalMarksByRubricId.get(row.rubricId) ?? [];
		if (row.label != null && row.marks != null) {
			list.push({ label: row.label, marks: toNumber(row.marks) });
		}
		ordinalMarksByRubricId.set(row.rubricId, list);
	}

	const rubricsByQuestionId = new Map<
		string,
		Array<{
			id: string;
			questionId: string;
			description: string | null;
			label: string | null;
			type: RubricType;
		}>
	>();
	for (const rubric of rubrics) {
		const list = rubricsByQuestionId.get(rubric.questionId) ?? [];
		list.push(rubric);
		rubricsByQuestionId.set(rubric.questionId, list);
	}

	return questions.map((question) => {
		const questionRubrics = rubricsByQuestionId.get(question.id) ?? [];

		return {
			id: question.id,
			label: question.label,
			rubrics: questionRubrics.map((rubric) => ({
				id: rubric.id,
				type: rubric.type,
				description: rubric.description,
				label: rubric.label,
				booleanRubric: booleanRubricById.get(rubric.id) ?? null,
				ordinalRubric: ordinalMarksByRubricId.has(rubric.id)
					? { marks: ordinalMarksByRubricId.get(rubric.id) ?? [] }
					: null,
				numericalRubric: numericalRubricById.get(rubric.id) ?? null,
			})),
		};
	});
}

export function questionCacheTags(): string[] {
	return [questionListCacheTag()];
}

export function toQuestionGrid(rows: QuestionRow[]): Grid {
	return Object.fromEntries(
		rows.map((row) => [
			row.id,
			{ label: row.label ?? undefined, rubrics: row.rubrics.map(toRubric) },
		]),
	);
}

// Canonical cached source for project-wide question rows. `loadQuestionGrid` and
// `loadQuestion` derive from this, so all three share one cache entry per project.
//
// The `db` option is a test seam only (ADR 0007 rules 13–14): runtime callers must
// omit it. A Kysely handle is a non-serializable class instance, and `"use cache"`
// serializes arguments to form the cache key, so passing one throws
// `Cannot serialize class instance` at runtime. Tests mock `next/cache`, which makes
// the directive inert so the handle reaches the primitive.
export async function loadQuestionRows(
	{ projectId }: { projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<QuestionRow[]> {
	"use cache";
	cacheTags(...questionCacheTags());
	cacheLife("definitions");
	return loadQuestionRowsFromDb(db, { projectId });
}

// Plain deriver: shares `loadQuestionRows`' cache entry at runtime. No `db` seam,
// because its only logic beyond the shared source is the pure `toQuestionGrid`,
// which is unit-tested directly.
export async function loadQuestionGrid({
	projectId,
}: {
	projectId: string;
}): Promise<Grid> {
	return toQuestionGrid(await loadQuestionRows({ projectId }));
}

export async function loadQuestion({
	projectId,
	questionId,
}: {
	projectId: string;
	questionId: string;
}): Promise<Question | undefined> {
	// Intentionally loads the whole project question set: warms the shared row cache
	// for grading navigation, which typically visits multiple questions. Add a
	// per-question primitive only if measurement shows the broad load is costly
	// (caching plan Decision 5).
	const rows = await loadQuestionRows({ projectId });
	const row = rows.find((item) => item.id === questionId);
	if (row == null) return undefined;
	return { label: row.label ?? undefined, rubrics: row.rubrics.map(toRubric) };
}
