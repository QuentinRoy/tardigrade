import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import { toCheckCriterion } from "#criteria/check/checkPersistence.ts";
import { toNumberCriterion } from "#criteria/number/numberPersistence.ts";
import type { Criterion, CriterionKind } from "#criteria/types.ts";
import { allRubricsTag, cacheTags } from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import type { Rubric, RubricsById } from "./types.ts";

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
		minValue: number;
		maxValue: number;
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
		return toNumberCriterion(data);
	}

	return toCheckCriterion(data);
}

export type RubricRow = {
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
			minValue: number;
			maxValue: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
		} | null;
	}[];
};

// `db` may be the global client or a caller-supplied transaction
// (a `Transaction<Database>` is a `Kysely<Database>`), so this composes inside
// a caller's tx.
export async function resolveGridRowId(
	db: Kysely<Database>,
	gridId: string,
): Promise<number> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();

	return grid.rowId;
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadRubricRowsFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
): Promise<RubricRow[]> {
	const gridRowId = await resolveGridRowId(db, gridId);

	const [rubrics, criteria, checkCriterions, numberCriterions, optionsMarks] =
		await Promise.all([
			db
				.selectFrom("rubric")
				.where("rubric.gridRowId", "=", gridRowId)
				.select(["id", "label", "position"])
				.orderBy("position", "asc")
				.execute(),
			db
				.selectFrom("criterion")
				.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
				.where("criterion.gridRowId", "=", gridRowId)
				.select([
					"criterion.id as id",
					"rubric.id as rubricId",
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
				.where("criterion.gridRowId", "=", gridRowId)
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
				.where("criterion.gridRowId", "=", gridRowId)
				.select([
					"criterion.id as criterionId",
					"numberCriterion.minValue as minValue",
					"numberCriterion.maxValue as maxValue",
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
				.where("criterion.gridRowId", "=", gridRowId)
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
				minValue: toNumber(row.minValue),
				maxValue: toNumber(row.maxValue),
				minMarks: toNumber(row.minMarks),
				maxMarks: toNumber(row.maxMarks),
				reversed: row.reversed,
			},
		]),
	);

	const optionsMarksByCriterionId = new Map<
		string,
		{ label: string; marks: number }[]
	>();
	for (const row of optionsMarks) {
		const list = optionsMarksByCriterionId.get(row.criterionId) ?? [];
		if (row.label != null && row.marks != null) {
			list.push({ label: row.label, marks: toNumber(row.marks) });
		}
		optionsMarksByCriterionId.set(row.criterionId, list);
	}

	const criteriaByRubricId = new Map<
		string,
		Array<{
			id: string;
			rubricId: string;
			description: string | null;
			label: string | null;
			kind: CriterionKind;
		}>
	>();
	for (const criterion of criteria) {
		const list = criteriaByRubricId.get(criterion.rubricId) ?? [];
		list.push(criterion);
		criteriaByRubricId.set(criterion.rubricId, list);
	}

	return rubrics.map((rubric) => {
		const rubricCriteria = criteriaByRubricId.get(rubric.id) ?? [];

		return {
			id: rubric.id,
			label: rubric.label,
			criteria: rubricCriteria.map((criterion) => ({
				id: criterion.id,
				kind: criterion.kind,
				description: criterion.description,
				label: criterion.label,
				checkCriterion: checkCriterionById.get(criterion.id) ?? null,
				optionsCriterion: optionsMarksByCriterionId.has(criterion.id)
					? { marks: optionsMarksByCriterionId.get(criterion.id) ?? [] }
					: null,
				numberCriterion: numberCriterionById.get(criterion.id) ?? null,
			})),
		};
	});
}

export function rubricCacheTags({ gridId }: { gridId: string }): string[] {
	return [allRubricsTag({ gridId })];
}

export function toRubricsById(rows: RubricRow[]): RubricsById {
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

// Canonical cached source for grid-wide rubric rows. `loadRubricsById` and
// `loadRubric` derive from this, so all three share one cache entry per grid.
//
// The `db` option is a test seam only (ADR 0007 rules 13–14): runtime callers must
// omit it. A Kysely handle is a non-serializable class instance, and `"use cache"`
// serializes arguments to form the cache key, so passing one throws
// `Cannot serialize class instance` at runtime. Tests mock `next/cache`, which makes
// the directive inert so the handle reaches the primitive.
export async function loadRubricRows(
	{ gridId }: { gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<RubricRow[]> {
	"use cache";
	cacheTags(...rubricCacheTags({ gridId }));
	cacheLife("definitions");
	return loadRubricRowsFromDb(db, { gridId });
}

// Plain deriver: shares `loadRubricRows`' cache entry at runtime. Forwards its
// own `db` option unchanged (no destructured default) so callers can use the same
// test seam without knowing this is a deriver. Omitted, the forwarded value stays
// `undefined`, so the call collapses to the exact shape `loadRubricRows` gets
// when called directly and the cache entry is shared, not split. Resolving a
// default here before forwarding would pass a real handle into the cached
// function even on the no-args runtime path — never do that (ADR 0007 rule 14).
export async function loadRubricsById(
	{ gridId }: { gridId: string },
	options?: { db?: Kysely<Database> },
): Promise<RubricsById> {
	return toRubricsById(await loadRubricRows({ gridId }, options));
}

export async function loadRubric(
	{ gridId, rubricId }: { gridId: string; rubricId: string },
	options?: { db?: Kysely<Database> },
): Promise<Rubric | undefined> {
	// Intentionally loads the whole grid rubric set: warms the shared row cache
	// for grading navigation, which typically visits multiple rubrics. Add a
	// per-rubric primitive only if measurement shows the broad load is costly
	// (caching plan Decision 5).
	const rows = await loadRubricRows({ gridId }, options);
	const row = rows.find((item) => item.id === rubricId);
	if (row == null) return undefined;
	return {
		label: row.label ?? undefined,
		criteria: row.criteria.map(toCriterion),
	};
}
