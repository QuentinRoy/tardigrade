import "server-only";
import type { Transaction } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type {
	OptionsCriterion,
	OptionsCriterionGradeContent,
	OptionsMarks,
} from "./optionsDomain.ts";

// Server-only persistence adapters for the Options criterion kind: batched
// definition-subtype upsert (with stale-mark reconciliation), grade-subtype
// write, and row→config read mapping (ADR 0013). `db` is a caller-supplied
// transaction; these are write primitives and cannot run on the global client.

export type OptionsSubtypeRow = { criterionRowId: number; marks: OptionsMarks };

// Batched upsert of Options definition subtype rows. The coordinator resolves
// each `criterionRowId` and groups by kind before calling this.
//
// Unlike Check and Number, an Options criterion's marks live in a child table
// keyed by label, so re-saving with a label removed must delete the row that
// label left behind. Marks are therefore reconciled, not just upserted: every
// mark row not named by the incoming marks is stale and deleted before the
// insert.
export async function upsertOptionsSubtypeRowsInDb(
	db: Transaction<Database>,
	rows: OptionsSubtypeRow[],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await db
		.insertInto("optionsCriterion")
		.values(rows.map((row) => ({ criterionId: row.criterionRowId })))
		.onConflict((conflict) => conflict.column("criterionId").doNothing())
		.execute();

	const optionsCriterionRows = await db
		.selectFrom("optionsCriterion")
		.select(["id", "criterionId"])
		.where(
			"criterionId",
			"in",
			rows.map((row) => row.criterionRowId),
		)
		.execute();

	const optionsCriterionIdByCriterionId = new Map(
		optionsCriterionRows.map((row) => [row.criterionId, row.id]),
	);
	const optionsCriterionIds = optionsCriterionRows.map((row) => row.id);

	const existingOptionsValues =
		optionsCriterionIds.length === 0
			? []
			: await db
					.selectFrom("optionsCriterionMark")
					.select(["id", "optionsCriterionId", "label"])
					.where("optionsCriterionId", "in", optionsCriterionIds)
					.execute();

	// Rows whose `criterionRowId` didn't resolve to an `optionsCriterionId`
	// (the just-inserted-but-not-yet-read-back case) are dropped from both the
	// reconciliation and the insert below.
	const resolvedRows = rows.flatMap((row) => {
		const optionsCriterionId = optionsCriterionIdByCriterionId.get(
			row.criterionRowId,
		);
		return optionsCriterionId == null
			? []
			: [{ optionsCriterionId, marks: row.marks }];
	});

	const validLabelsByCriterionId = new Map(
		resolvedRows.map(({ optionsCriterionId, marks }) => [
			optionsCriterionId,
			new Set(Object.keys(marks)),
		]),
	);

	const staleIds = existingOptionsValues
		.filter(
			(value) =>
				!validLabelsByCriterionId
					.get(value.optionsCriterionId)
					?.has(value.label),
		)
		.map((value) => value.id);

	if (staleIds.length > 0) {
		await db
			.deleteFrom("optionsCriterionMark")
			.where("id", "in", staleIds)
			.execute();
	}

	const optionsValueRows = resolvedRows.flatMap(
		({ optionsCriterionId, marks }) =>
			Object.entries(marks).map(([label, markValue]) => ({
				optionsCriterionId,
				label,
				marks: markValue,
			})),
	);

	if (optionsValueRows.length > 0) {
		await db
			.insertInto("optionsCriterionMark")
			.values(optionsValueRows)
			.onConflict((conflict) =>
				conflict
					.columns(["optionsCriterionId", "label"])
					.doUpdateSet((eb) => ({ marks: eb.ref("excluded.marks") })),
			)
			.execute();
	}
}

// Writes an Options criterion grade's subtype row. The coordinator validates the
// selected label against the criterion's marks and upserts the parent
// `criterionGrade` first, so this never runs before the parent row exists.
export async function writeOptionsGradeInDb(
	db: Transaction<Database>,
	criterionGradeId: number,
	grade: OptionsCriterionGradeContent,
): Promise<void> {
	await db
		.insertInto("optionsCriterionGrade")
		.values({ criterionGradeId, selectedLabel: grade.selectedLabel })
		.onConflict((conflict) =>
			conflict
				.column("criterionGradeId")
				.doUpdateSet({ selectedLabel: grade.selectedLabel }),
		)
		.execute();
}

// Maps a loaded criterion row (base fields + the joined Options mark rows) to the
// canonical `OptionsCriterion` config. The exhaustive `toCriterion` dispatcher
// delegates its `options` branch here.
export function toOptionsCriterion(data: {
	id: string;
	description: string | null;
	label: string | null;
	optionsCriterion: { marks: { label: string; marks: number }[] } | null;
}): OptionsCriterion {
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
			data.optionsCriterion.marks.map((item) => [item.label, item.marks]),
		),
	};
}
