import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { saveCriterionSubtypesInDb } from "#criteria/criterionSubtypePersistence.ts";
import type { Database } from "#db/generated/database.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import {
	upsertNumberSubtypeRowsInDb,
	validateNumberGradeInDb,
} from "./numberPersistence.ts";

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

	await db.transaction().execute((tx) =>
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

	await db
		.transaction()
		.execute((tx) =>
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

	await db
		.transaction()
		.execute((tx) =>
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

test("validateNumberGradeInDb accepts a value inside the criterion's range", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Number validation grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createNumberCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await db
		.transaction()
		.execute((tx) =>
			upsertNumberSubtypeRowsInDb(tx, [
				{
					criterionRowId: criterion.rowId,
					minValue: 0,
					maxValue: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
				},
			]),
		);

	const result = await db
		.transaction()
		.execute((tx) =>
			validateNumberGradeInDb(tx, {
				criterionRowId: criterion.rowId,
				grade: { value: 7 },
			}),
		);

	expect(result).toEqual({ valid: true });
});

test("validateNumberGradeInDb rejects a value outside the criterion's range", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Number validation range grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createNumberCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await db
		.transaction()
		.execute((tx) =>
			upsertNumberSubtypeRowsInDb(tx, [
				{
					criterionRowId: criterion.rowId,
					minValue: 0,
					maxValue: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
				},
			]),
		);

	expect(
		await db
			.transaction()
			.execute((tx) =>
				validateNumberGradeInDb(tx, {
					criterionRowId: criterion.rowId,
					grade: { value: -1 },
				}),
			),
	).toEqual({ valid: false, message: "Enter a value of at least 0." });
	expect(
		await db
			.transaction()
			.execute((tx) =>
				validateNumberGradeInDb(tx, {
					criterionRowId: criterion.rowId,
					grade: { value: 11 },
				}),
			),
	).toEqual({ valid: false, message: "Enter a value of at most 10." });
});

test("validateNumberGradeInDb rejects a non-finite value", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Number validation non-finite grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createNumberCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await db
		.transaction()
		.execute((tx) =>
			upsertNumberSubtypeRowsInDb(tx, [
				{
					criterionRowId: criterion.rowId,
					minValue: 0,
					maxValue: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
				},
			]),
		);

	const result = await db
		.transaction()
		.execute((tx) =>
			validateNumberGradeInDb(tx, {
				criterionRowId: criterion.rowId,
				grade: { value: Number.NaN },
			}),
		);

	expect(result).toEqual({
		valid: false,
		message: "Enter a valid value and try again.",
	});
});

test("validateNumberGradeInDb rejects when the criterion has no subtype row", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Number validation missing row grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createNumberCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	const result = await db
		.transaction()
		.execute((tx) =>
			validateNumberGradeInDb(tx, {
				criterionRowId: criterion.rowId,
				grade: { value: 5 },
			}),
		);

	expect(result).toEqual({
		valid: false,
		message:
			"This value range is currently unavailable. Reload and try again. If it still fails, report this issue.",
	});
});
