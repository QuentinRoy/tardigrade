import "server-only";
import type { Transaction } from "kysely";
import type { Database } from "#db/generated/database.ts";
import { upsertCheckSubtypeRowsInDb } from "./check/checkPersistence.ts";
import type { CheckCriterionEditorValue } from "./check/checkSchemas.ts";
import type { CriterionForKind } from "./types.ts";

// Generic criterion-definition subtype coordinator (ADR 0013). It resolves the
// criterion row ids both rubric verticals used to resolve inline, groups by kind,
// and dispatches to each kind's batched subtype adapter. The criterion base-row
// insert/update/delete stays in each vertical (their semantics differ by design);
// `rubric-management` and `imports` call this downward inside their own
// transactions and own cache invalidation.
//
// It handles all three kinds from day one so PR1 deletes the duplicated subtype
// code from both callers. Only the `check` adapter lives in its folder yet;
// `number`/`options` writers are private helpers here and move into their folders
// in PR2/PR3 as pure moves.

// The Check variant honestly sources Check's optional `falseMarks` from the
// editor schema output; Number/Options derive from the domain union (their
// subtype fields match exactly). Both callers' values are already assignable.
type CriterionSubtypeInput =
	| Pick<CheckCriterionEditorValue, "id" | "kind" | "marks" | "falseMarks">
	| Omit<CriterionForKind<"number">, "description" | "label">
	| Omit<CriterionForKind<"options">, "description" | "label">;

export async function saveCriterionSubtypesInDb(
	db: Transaction<Database>,
	{
		criteria,
		gridRowId,
		rubricRowId,
	}: {
		criteria: CriterionSubtypeInput[];
		gridRowId: number;
		rubricRowId?: number;
	},
): Promise<void> {
	if (criteria.length === 0) {
		return;
	}

	let query = db
		.selectFrom("criterion")
		.select(["id", "rowId"])
		.where("gridRowId", "=", gridRowId)
		.where(
			"id",
			"in",
			criteria.map((criterion) => criterion.id),
		);
	if (rubricRowId != null) {
		query = query.where("rubricId", "=", rubricRowId);
	}
	const criterionRows = await query.execute();
	const criterionRowIdById = new Map(
		criterionRows.map((criterion) => [criterion.id, criterion.rowId]),
	);

	function resolveCriterionRowId(id: string): number {
		const rowId = criterionRowIdById.get(id);
		if (rowId == null) {
			throw new Error(`Criterion '${id}' could not be resolved.`);
		}
		return rowId;
	}

	const checkRows: Array<{
		criterionRowId: number;
		marks: number;
		falseMarks: number;
	}> = [];
	const numberRows: NumberSubtypeRow[] = [];
	const optionsRows: OptionsSubtypeRow[] = [];

	for (const criterion of criteria) {
		if (criterion.kind === "check") {
			checkRows.push({
				criterionRowId: resolveCriterionRowId(criterion.id),
				marks: criterion.marks,
				falseMarks: criterion.falseMarks ?? 0,
			});
			continue;
		}

		if (criterion.kind === "number") {
			numberRows.push({
				criterionRowId: resolveCriterionRowId(criterion.id),
				minValue: criterion.minValue,
				maxValue: criterion.maxValue,
				minMarks: criterion.minMarks,
				maxMarks: criterion.maxMarks,
				reversed: criterion.reversed,
			});
			continue;
		}

		optionsRows.push({
			criterionRowId: resolveCriterionRowId(criterion.id),
			marks: criterion.marks,
		});
	}

	await Promise.all([
		upsertCheckSubtypeRowsInDb(db, checkRows),
		upsertNumberSubtypeRowsInDb(db, numberRows),
		upsertOptionsSubtypeRowsInDb(db, optionsRows),
	]);
}

type NumberSubtypeRow = {
	criterionRowId: number;
	minValue: number;
	maxValue: number;
	minMarks: number;
	maxMarks: number;
	reversed: boolean;
};

// Private until PR2 relocates it into `criteria/number/` as a pure move.
async function upsertNumberSubtypeRowsInDb(
	db: Transaction<Database>,
	rows: NumberSubtypeRow[],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await db
		.insertInto("numberCriterion")
		.values(
			rows.map((row) => ({
				criterionId: row.criterionRowId,
				minValue: row.minValue,
				maxValue: row.maxValue,
				minMarks: row.minMarks,
				maxMarks: row.maxMarks,
				reversed: row.reversed,
			})),
		)
		.onConflict((conflict) =>
			conflict
				.column("criterionId")
				.doUpdateSet((eb) => ({
					minValue: eb.ref("excluded.minValue"),
					maxValue: eb.ref("excluded.maxValue"),
					minMarks: eb.ref("excluded.minMarks"),
					maxMarks: eb.ref("excluded.maxMarks"),
					reversed: eb.ref("excluded.reversed"),
				})),
		)
		.execute();
}

type OptionsSubtypeRow = {
	criterionRowId: number;
	marks: Record<string, number>;
};

// Private until PR3 relocates it (with its mark reconciliation) into
// `criteria/options/` as a pure move.
async function upsertOptionsSubtypeRowsInDb(
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

	const optionsCriterions = await db
		.selectFrom("optionsCriterion")
		.select(["id", "criterionId"])
		.where(
			"criterionId",
			"in",
			rows.map((row) => row.criterionRowId),
		)
		.execute();

	const optionsCriterionIdByCriterionId = new Map(
		optionsCriterions.map((row) => [row.criterionId, row.id]),
	);
	const optionsCriterionIds = optionsCriterions.map((row) => row.id);

	const existingOptionsValues =
		optionsCriterionIds.length === 0
			? []
			: await db
					.selectFrom("optionsCriterionMark")
					.select(["id", "optionsCriterionId", "label"])
					.where("optionsCriterionId", "in", optionsCriterionIds)
					.execute();

	const validKeys = new Set(
		rows.flatMap((row) => {
			const optionsCriterionId = optionsCriterionIdByCriterionId.get(
				row.criterionRowId,
			);
			if (optionsCriterionId == null) {
				return [];
			}
			return Object.keys(row.marks).map(
				(label) => `${optionsCriterionId}::${label}`,
			);
		}),
	);

	const staleIds = existingOptionsValues
		.filter(
			(value) => !validKeys.has(`${value.optionsCriterionId}::${value.label}`),
		)
		.map((value) => value.id);

	if (staleIds.length > 0) {
		await db
			.deleteFrom("optionsCriterionMark")
			.where("id", "in", staleIds)
			.execute();
	}

	const optionsValueRows = rows.flatMap((row) => {
		const optionsCriterionId = optionsCriterionIdByCriterionId.get(
			row.criterionRowId,
		);
		if (optionsCriterionId == null) {
			return [];
		}
		return Object.entries(row.marks).map(([label, marks]) => ({
			optionsCriterionId,
			label,
			marks,
		}));
	});

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
