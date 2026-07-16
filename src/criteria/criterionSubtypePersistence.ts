import "server-only";
import type { Transaction } from "kysely";
import type { Database } from "#db/generated/database.ts";
import { upsertCheckSubtypeRowsInDb } from "./check/checkPersistence.ts";
import type { CheckCriterionEditorValue } from "./check/checkSchemas.ts";
import {
	type NumberSubtypeRow,
	upsertNumberSubtypeRowsInDb,
} from "./number/numberPersistence.ts";
import type { NumberCriterionEditorValue } from "./number/numberSchemas.ts";
import type { CriterionForKind } from "./types.ts";

// Generic criterion-definition subtype coordinator (ADR 0013). It resolves the
// criterion row ids both rubric verticals used to resolve inline, groups by kind,
// and dispatches to each kind's batched subtype adapter. The criterion base-row
// insert/update/delete stays in each vertical (their semantics differ by design);
// `rubric-management` and `imports` call this downward inside their own
// transactions and own cache invalidation.
//
// It handles all three kinds from day one so PR1 deletes the duplicated subtype
// code from both callers. The `check` and `number` adapters live in their
// folders; the `options` writer is a private helper here and moves into its
// folder in PR3 as a pure move.

// Check and Number source their subtype fields from their editor schema outputs;
// Options derives from the domain union (its subtype fields match exactly). Both
// callers' values are already assignable.
type CriterionSubtypeInput =
	| Pick<CheckCriterionEditorValue, "id" | "kind" | "marks" | "falseMarks">
	| Pick<
			NumberCriterionEditorValue,
			| "id"
			| "kind"
			| "minValue"
			| "maxValue"
			| "minMarks"
			| "maxMarks"
			| "reversed"
	  >
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
