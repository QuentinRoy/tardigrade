import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { saveCriterionSubtypesInDb } from "#criteria/criterionSubtypePersistence.ts";
import type { Database } from "#db/generated/database.ts";
import {
	buildTestId,
	createTestDb,
	inTransaction,
} from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import { upsertNumberSubtypeRowsInDb } from "./numberPersistence.ts";

async function createRubricRow(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<number> {
	const rubric = await db
		.insertInto("rubric")
		.values({
			gridRowId,
			id: buildTestId("rubric"),
			label: "Rubric",
			position: 0,
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();
	return rubric.rowId;
}

async function createNumberCriterionRow(
	db: Kysely<Database>,
	gridRowId: number,
	rubricRowId: number,
	position: number,
): Promise<{ id: string; rowId: number }> {
	const id = buildTestId("criterion-number");
	const criterion = await db
		.insertInto("criterion")
		.values({ gridRowId, id, rubricId: rubricRowId, kind: "number", position })
		.returning("rowId")
		.executeTakeFirstOrThrow();
	return { id, rowId: criterion.rowId };
}

async function loadNumberRow(db: Kysely<Database>, criterionRowId: number) {
	const row = await db
		.selectFrom("numberCriterion")
		.select(["minValue", "maxValue", "minMarks", "maxMarks", "reversed"])
		.where("criterionId", "=", criterionRowId)
		.executeTakeFirst();
	if (row == null) {
		return undefined;
	}
	// Postgres returns `numeric` columns as strings; coerce for value comparison.
	return {
		minValue: Number(row.minValue),
		maxValue: Number(row.maxValue),
		minMarks: Number(row.minMarks),
		maxMarks: Number(row.maxMarks),
		reversed: row.reversed,
	};
}

test("upsertNumberSubtypeRowsInDb batches inserts then upserts on conflict", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Number subtype grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const first = await createNumberCriterionRow(db, grid.rowId, rubricRowId, 0);
	const second = await createNumberCriterionRow(db, grid.rowId, rubricRowId, 1);

	await inTransaction(db, (tx) =>
		upsertNumberSubtypeRowsInDb(tx, [
			{
				criterionRowId: first.rowId,
				minValue: 0,
				maxValue: 10,
				minMarks: 0,
				maxMarks: 5,
				reversed: false,
			},
			{
				criterionRowId: second.rowId,
				minValue: 1,
				maxValue: 4,
				minMarks: -2,
				maxMarks: 2,
				reversed: true,
			},
		]),
	);

	expect(await loadNumberRow(db, first.rowId)).toEqual({
		minValue: 0,
		maxValue: 10,
		minMarks: 0,
		maxMarks: 5,
		reversed: false,
	});
	expect(await loadNumberRow(db, second.rowId)).toEqual({
		minValue: 1,
		maxValue: 4,
		minMarks: -2,
		maxMarks: 2,
		reversed: true,
	});

	await inTransaction(db, (tx) =>
		upsertNumberSubtypeRowsInDb(tx, [
			{
				criterionRowId: first.rowId,
				minValue: 2,
				maxValue: 8,
				minMarks: 1,
				maxMarks: 3,
				reversed: true,
			},
		]),
	);

	expect(await loadNumberRow(db, first.rowId)).toEqual({
		minValue: 2,
		maxValue: 8,
		minMarks: 1,
		maxMarks: 3,
		reversed: true,
	});
});

test("saveCriterionSubtypesInDb resolves row ids and dispatches the Number upsert", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Coordinator dispatch grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createNumberCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await inTransaction(db, (tx) =>
		saveCriterionSubtypesInDb(tx, {
			criteria: [
				{
					id: criterion.id,
					kind: "number",
					minValue: 0,
					maxValue: 20,
					minMarks: 0,
					maxMarks: 10,
					reversed: false,
				},
			],
			gridRowId: grid.rowId,
			rubricRowId,
		}),
	);

	expect(await loadNumberRow(db, criterion.rowId)).toEqual({
		minValue: 0,
		maxValue: 20,
		minMarks: 0,
		maxMarks: 10,
		reversed: false,
	});
});
