import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { saveCriterionSubtypesInDb } from "#criteria/criterionSubtypePersistence.ts";
import type { Database } from "#db/generated/database.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import { upsertCheckSubtypeRowsInDb } from "./checkPersistence.ts";

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

async function createCheckCriterionRow(
	db: Kysely<Database>,
	gridRowId: number,
	rubricRowId: number,
	position: number,
): Promise<{ id: string; rowId: number }> {
	const id = buildTestId("criterion-check");
	const criterion = await db
		.insertInto("criterion")
		.values({ gridRowId, id, rubricId: rubricRowId, kind: "check", position })
		.returning("rowId")
		.executeTakeFirstOrThrow();
	return { id, rowId: criterion.rowId };
}

async function loadCheckRow(db: Kysely<Database>, criterionRowId: number) {
	const row = await db
		.selectFrom("checkCriterion")
		.select(["marks", "falseMarks"])
		.where("criterionId", "=", criterionRowId)
		.executeTakeFirst();
	if (row == null) {
		return undefined;
	}
	// Postgres returns `numeric` columns as strings; coerce for value comparison.
	return { marks: Number(row.marks), falseMarks: Number(row.falseMarks) };
}

test("upsertCheckSubtypeRowsInDb batches inserts then upserts on conflict", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Check subtype grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const first = await createCheckCriterionRow(db, grid.rowId, rubricRowId, 0);
	const second = await createCheckCriterionRow(db, grid.rowId, rubricRowId, 1);

	await upsertCheckSubtypeRowsInDb(db, [
		{ criterionRowId: first.rowId, marks: 2, falseMarks: 0 },
		{ criterionRowId: second.rowId, marks: 5, falseMarks: -1 },
	]);

	expect(await loadCheckRow(db, first.rowId)).toEqual({
		marks: 2,
		falseMarks: 0,
	});
	expect(await loadCheckRow(db, second.rowId)).toEqual({
		marks: 5,
		falseMarks: -1,
	});

	await upsertCheckSubtypeRowsInDb(db, [
		{ criterionRowId: first.rowId, marks: 3, falseMarks: 1 },
	]);

	expect(await loadCheckRow(db, first.rowId)).toEqual({
		marks: 3,
		falseMarks: 1,
	});
});

test("saveCriterionSubtypesInDb resolves row ids and dispatches the Check upsert", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Coordinator dispatch grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createCheckCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await saveCriterionSubtypesInDb(db, {
		criteria: [{ id: criterion.id, kind: "check", marks: 4, falseMarks: 2 }],
		gridRowId: grid.rowId,
		rubricRowId,
	});

	expect(await loadCheckRow(db, criterion.rowId)).toEqual({
		marks: 4,
		falseMarks: 2,
	});

	// `falseMarks` omitted resolves to 0 (matching the pre-refactor callers).
	await saveCriterionSubtypesInDb(db, {
		criteria: [{ id: criterion.id, kind: "check", marks: 6 }],
		gridRowId: grid.rowId,
		rubricRowId,
	});

	expect(await loadCheckRow(db, criterion.rowId)).toEqual({
		marks: 6,
		falseMarks: 0,
	});
});
