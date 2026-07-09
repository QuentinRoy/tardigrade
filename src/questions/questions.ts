import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import type { Criterion, CriterionKind } from "#criteria/types.ts";
import { cacheTags, questionListCacheTag } from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import type { Grid, Question } from "./types.ts";

export function toNumber(value: string | number): number {
	if (typeof value === "number") return value;
	return parseFloat(value);
}

export function toCriterion(data: {
	id: string;
	kind: CriterionKind;
	description: string | null;
	label: string | null;
	checkCriterion: { marks: number; falseMarks: number } | null;
	optionsCriterion: { marks: { label: string; marks: number }[] } | null;
	numberCriterion: {
		minScore: number;
		maxScore: number;
		minMarks: number;
		maxMarks: number;
		reversed: boolean;
	} | null;
}): Criterion {
	if (data.kind === "options") {
		if (data.optionsCriterion == null) {
			throw new Error(
				`Criterion Subtype Invariant violation: missing optionsCriterion row for criterion ${data.id}.`,
			);
		}
		return {
			id: data.id,
			description: data.description ?? undefined,
			label: data.label ?? undefined,
			kind: "options",
			marks: Object.fromEntries(
				data.optionsCriterion.marks.map((item) => [
					item.label,
					toNumber(item.marks),
				]),
			),
		};
	}

	if (data.kind === "number") {
		if (data.numberCriterion == null) {
			throw new Error(
				`Criterion Subtype Invariant violation: missing numberCriterion row for criterion ${data.id}.`,
			);
		}
		return {
			id: data.id,
			description: data.description ?? undefined,
			label: data.label ?? undefined,
			kind: "number",
			minScore: toNumber(data.numberCriterion.minScore),
			maxScore: toNumber(data.numberCriterion.maxScore),
			minMarks: toNumber(data.numberCriterion.minMarks),
			maxMarks: toNumber(data.numberCriterion.maxMarks),
			reversed: data.numberCriterion.reversed,
		};
	}

	if (data.checkCriterion == null) {
		throw new Error(
			`Criterion Subtype Invariant violation: missing checkCriterion row for criterion ${data.id}.`,
		);
	}
	return {
		id: data.id,
		description: data.description ?? undefined,
		label: data.label ?? undefined,
		kind: "check",
		marks: toNumber(data.checkCriterion.marks),
		falseMarks: toNumber(data.checkCriterion.falseMarks),
	};
}

export type QuestionRow = {
	id: string;
	label: string | null;
	criteria: {
		id: string;
		kind: CriterionKind;
		description: string | null;
		label: string | null;
		checkCriterion: { marks: number; falseMarks: number } | null;
		optionsCriterion: { marks: { label: string; marks: number }[] } | null;
		numberCriterion: {
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

	const [questions, criteria, checkCriterions, numberCriterions, ordinalMarks] =
		await Promise.all([
			db
				.selectFrom("question")
				.where("question.projectId", "=", projectRowId)
				.select(["id", "label", "position"])
				.orderBy("position", "asc")
				.execute(),
			db
				.selectFrom("criterion")
				.innerJoin("question", "question.rowId", "criterion.questionId")
				.where("criterion.projectId", "=", projectRowId)
				.select([
					"criterion.id as id",
					"question.id as questionId",
					"criterion.position as position",
					"criterion.description as description",
					"criterion.label as label",
					"criterion.kind as kind",
				])
				.orderBy("criterion.position", "asc")
				.execute(),
			db
				.selectFrom("checkCriterion")
				.innerJoin("criterion", "criterion.rowId", "checkCriterion.criterionId")
				.where("criterion.projectId", "=", projectRowId)
				.select([
					"criterion.id as criterionId",
					"checkCriterion.marks as marks",
					"checkCriterion.falseMarks as falseMarks",
				])
				.execute(),
			db
				.selectFrom("numberCriterion")
				.innerJoin(
					"criterion",
					"criterion.rowId",
					"numberCriterion.criterionId",
				)
				.where("criterion.projectId", "=", projectRowId)
				.select([
					"criterion.id as criterionId",
					"numberCriterion.minScore as minScore",
					"numberCriterion.maxScore as maxScore",
					"numberCriterion.minMarks as minMarks",
					"numberCriterion.maxMarks as maxMarks",
					"numberCriterion.reversed as reversed",
				])
				.execute(),
			db
				.selectFrom("optionsCriterion")
				.leftJoin(
					"optionsCriterionMark",
					"optionsCriterionMark.optionsCriterionId",
					"optionsCriterion.id",
				)
				.innerJoin(
					"criterion",
					"criterion.rowId",
					"optionsCriterion.criterionId",
				)
				.where("criterion.projectId", "=", projectRowId)
				.select([
					"criterion.id as criterionId",
					"optionsCriterionMark.label as label",
					"optionsCriterionMark.marks as marks",
				])
				.orderBy("optionsCriterionMark.marks", "desc")
				.orderBy("optionsCriterionMark.label", "asc")
				.execute(),
		]);

	const checkCriterionById = new Map(
		checkCriterions.map((row) => [
			row.criterionId,
			{ marks: toNumber(row.marks), falseMarks: toNumber(row.falseMarks) },
		]),
	);

	const numberCriterionById = new Map(
		numberCriterions.map((row) => [
			row.criterionId,
			{
				minScore: toNumber(row.minScore),
				maxScore: toNumber(row.maxScore),
				minMarks: toNumber(row.minMarks),
				maxMarks: toNumber(row.maxMarks),
				reversed: row.reversed,
			},
		]),
	);

	const ordinalMarksByCriterionId = new Map<
		string,
		{ label: string; marks: number }[]
	>();
	for (const row of ordinalMarks) {
		const list = ordinalMarksByCriterionId.get(row.criterionId) ?? [];
		if (row.label != null && row.marks != null) {
			list.push({ label: row.label, marks: toNumber(row.marks) });
		}
		ordinalMarksByCriterionId.set(row.criterionId, list);
	}

	const criteriaByQuestionId = new Map<
		string,
		Array<{
			id: string;
			questionId: string;
			description: string | null;
			label: string | null;
			kind: CriterionKind;
		}>
	>();
	for (const criterion of criteria) {
		const list = criteriaByQuestionId.get(criterion.questionId) ?? [];
		list.push(criterion);
		criteriaByQuestionId.set(criterion.questionId, list);
	}

	return questions.map((question) => {
		const questionCriteria = criteriaByQuestionId.get(question.id) ?? [];

		return {
			id: question.id,
			label: question.label,
			criteria: questionCriteria.map((criterion) => ({
				id: criterion.id,
				kind: criterion.kind,
				description: criterion.description,
				label: criterion.label,
				checkCriterion: checkCriterionById.get(criterion.id) ?? null,
				optionsCriterion: ordinalMarksByCriterionId.has(criterion.id)
					? { marks: ordinalMarksByCriterionId.get(criterion.id) ?? [] }
					: null,
				numberCriterion: numberCriterionById.get(criterion.id) ?? null,
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
			{
				label: row.label ?? undefined,
				criteria: row.criteria.map(toCriterion),
			},
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

// Plain deriver: shares `loadQuestionRows`' cache entry at runtime. Forwards its
// own `db` option unchanged (no destructured default) so callers can use the same
// test seam without knowing this is a deriver. Omitted, the forwarded value stays
// `undefined`, so the call collapses to the exact shape `loadQuestionRows` gets
// when called directly and the cache entry is shared, not split. Resolving a
// default here before forwarding would pass a real handle into the cached
// function even on the no-args runtime path — never do that (ADR 0007 rule 14).
export async function loadQuestionGrid(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<Grid> {
	return toQuestionGrid(await loadQuestionRows({ projectId }, options));
}

export async function loadQuestion(
	{ projectId, questionId }: { projectId: string; questionId: string },
	options?: { db?: Kysely<DB> },
): Promise<Question | undefined> {
	// Intentionally loads the whole project question set: warms the shared row cache
	// for grading navigation, which typically visits multiple questions. Add a
	// per-question primitive only if measurement shows the broad load is costly
	// (caching plan Decision 5).
	const rows = await loadQuestionRows({ projectId }, options);
	const row = rows.find((item) => item.id === questionId);
	if (row == null) return undefined;
	return {
		label: row.label ?? undefined,
		criteria: row.criteria.map(toCriterion),
	};
}
