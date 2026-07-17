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
import {
	type OptionsSubtypeRow,
	upsertOptionsSubtypeRowsInDb,
} from "./options/optionsPersistence.ts";
import type { OptionsCriterionEditorValue } from "./options/optionsSchemas.ts";

// Generic criterion-definition subtype coordinator (ADR 0013). It resolves the
// criterion row ids both rubric verticals used to resolve inline, groups by kind,
// and dispatches to each kind's batched subtype adapter. The criterion base-row
// insert/update/delete stays in each vertical (their semantics differ by design);
// `rubric-management` and `imports` call this downward inside their own
// transactions and own cache invalidation.

// Every kind sources its subtype fields from its own editor schema output. Both
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
	| Pick<OptionsCriterionEditorValue, "id" | "kind" | "marks">;

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
