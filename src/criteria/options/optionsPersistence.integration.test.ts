import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { saveCriterionSubtypesInDb } from "#criteria/criterionSubtypePersistence.ts";
import type { Database } from "#db/generated/database.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import type { OptionsMarks } from "./optionsDomain.ts";
import {
	upsertOptionsSubtypeRowsInDb,
	validateOptionsGradeInDb,
} from "./optionsPersistence.ts";

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

async function createOptionsCriterionRow(
	db: Kysely<Database>,
	gridRowId: number,
	rubricRowId: number,
	position: number,
): Promise<{ id: string; rowId: number }> {
	const id = buildTestId("criterion-options");
	const criterion = await db
		.insertInto("criterion")
		.values({ gridRowId, id, rubricRowId, kind: "options", position })
		.returning("rowId")
		.executeTakeFirstOrThrow();
	return { id, rowId: criterion.rowId };
}

// Reads the persisted marks back as the authored `Record<label, marks>`.
async function loadOptionsMarks(
	db: Kysely<Database>,
	criterionRowId: number,
): Promise<OptionsMarks | undefined> {
	const optionsCriterion = await db
		.selectFrom("optionsCriterion")
		.select("criterionRowId")
		.where("criterionRowId", "=", criterionRowId)
		.executeTakeFirst();
	if (optionsCriterion == null) {
		return undefined;
	}

	const marks = await db
		.selectFrom("optionsCriterionMark")
		.select(["label", "marks"])
		.where("criterionRowId", "=", optionsCriterion.criterionRowId)
		.execute();

	// Postgres returns `numeric` columns as strings; coerce for value comparison.
	return Object.fromEntries(marks.map((row) => [row.label, Number(row.marks)]));
}

test("upsertOptionsSubtypeRowsInDb batches inserts across criteria", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Options subtype grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const first = await createOptionsCriterionRow(db, grid.rowId, rubricRowId, 0);
	const second = await createOptionsCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		1,
	);

	await db.transaction().execute((tx) =>
		upsertOptionsSubtypeRowsInDb(tx, [
			{ criterionRowId: first.rowId, marks: { Pass: 1, Fail: 0 } },
			{ criterionRowId: second.rowId, marks: { Good: 2, Poor: -1 } },
		]),
	);

	expect(await loadOptionsMarks(db, first.rowId)).toEqual({ Pass: 1, Fail: 0 });
	expect(await loadOptionsMarks(db, second.rowId)).toEqual({
		Good: 2,
		Poor: -1,
	});
});

test("upsertOptionsSubtypeRowsInDb updates the marks of an existing label", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Options mark update grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createOptionsCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await db
		.transaction()
		.execute((tx) =>
			upsertOptionsSubtypeRowsInDb(tx, [
				{ criterionRowId: criterion.rowId, marks: { Pass: 1, Fail: 0 } },
			]),
		);
	await db
		.transaction()
		.execute((tx) =>
			upsertOptionsSubtypeRowsInDb(tx, [
				{ criterionRowId: criterion.rowId, marks: { Pass: 5, Fail: -2 } },
			]),
		);

	expect(await loadOptionsMarks(db, criterion.rowId)).toEqual({
		Pass: 5,
		Fail: -2,
	});
});

// Options is the one kind whose marks live in a child table keyed by label, so a
// re-save that drops a label must delete the row it left behind rather than
// leaving a mark no author can see.
test("upsertOptionsSubtypeRowsInDb deletes marks whose label is no longer authored", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Options reconciliation grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createOptionsCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await db
		.transaction()
		.execute((tx) =>
			upsertOptionsSubtypeRowsInDb(tx, [
				{
					criterionRowId: criterion.rowId,
					marks: { Good: 2, Fair: 1, Poor: 0 },
				},
			]),
		);
	await db
		.transaction()
		.execute((tx) =>
			upsertOptionsSubtypeRowsInDb(tx, [
				{ criterionRowId: criterion.rowId, marks: { Good: 2, Poor: 0 } },
			]),
		);

	expect(await loadOptionsMarks(db, criterion.rowId)).toEqual({
		Good: 2,
		Poor: 0,
	});
});

// Reconciliation is scoped per criterion: one criterion's labels must never mark
// another's rows stale, even in the same batch.
test("upsertOptionsSubtypeRowsInDb reconciles each criterion independently", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Options per-criterion grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const first = await createOptionsCriterionRow(db, grid.rowId, rubricRowId, 0);
	const second = await createOptionsCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		1,
	);

	await db.transaction().execute((tx) =>
		upsertOptionsSubtypeRowsInDb(tx, [
			{ criterionRowId: first.rowId, marks: { Good: 2, Fair: 1 } },
			{ criterionRowId: second.rowId, marks: { Yes: 1, No: 0 } },
		]),
	);
	await db.transaction().execute((tx) =>
		upsertOptionsSubtypeRowsInDb(tx, [
			{ criterionRowId: first.rowId, marks: { Good: 2, Poor: -1 } },
			{ criterionRowId: second.rowId, marks: { Yes: 1, No: 0 } },
		]),
	);

	expect(await loadOptionsMarks(db, first.rowId)).toEqual({
		Good: 2,
		Poor: -1,
	});
	expect(await loadOptionsMarks(db, second.rowId)).toEqual({ Yes: 1, No: 0 });
});

test("saveCriterionSubtypesInDb resolves row ids and dispatches the Options upsert", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Coordinator dispatch grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createOptionsCriterionRow(
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
					{ id: criterion.id, kind: "options", marks: { Pass: 3, Fail: 0 } },
				],
				gridRowId: grid.rowId,
				rubricRowId,
			}),
		);

	expect(await loadOptionsMarks(db, criterion.rowId)).toEqual({
		Pass: 3,
		Fail: 0,
	});
});

// Coverage for reconciliation dispatched through the coordinator (not just
// upsertOptionsSubtypeRowsInDb directly), matching how a rubric definition
// re-save drops a label in production.
test("saveCriterionSubtypesInDb reconciles Options marks across repeated dispatch", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Coordinator reconciliation grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createOptionsCriterionRow(
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
					{ id: criterion.id, kind: "options", marks: { Pass: 1, Fail: 0 } },
				],
				gridRowId: grid.rowId,
				rubricRowId,
			}),
		);
	await db
		.transaction()
		.execute((tx) =>
			saveCriterionSubtypesInDb(tx, {
				criteria: [{ id: criterion.id, kind: "options", marks: { Pass: 3 } }],
				gridRowId: grid.rowId,
				rubricRowId,
			}),
		);

	expect(await loadOptionsMarks(db, criterion.rowId)).toEqual({ Pass: 3 });
});

test("validateOptionsGradeInDb accepts a label the criterion currently offers", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Options validation grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createOptionsCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await db
		.transaction()
		.execute((tx) =>
			upsertOptionsSubtypeRowsInDb(tx, [
				{ criterionRowId: criterion.rowId, marks: { Pass: 1, Fail: 0 } },
			]),
		);

	const result = await db
		.transaction()
		.execute((tx) =>
			validateOptionsGradeInDb(tx, {
				criterionRowId: criterion.rowId,
				grade: { selectedLabel: "Pass" },
			}),
		);

	expect(result).toEqual({ valid: true });
});

test("validateOptionsGradeInDb rejects a label the criterion no longer offers", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Options validation rejection grid");
	const rubricRowId = await createRubricRow(db, grid.rowId);
	const criterion = await createOptionsCriterionRow(
		db,
		grid.rowId,
		rubricRowId,
		0,
	);

	await db
		.transaction()
		.execute((tx) =>
			upsertOptionsSubtypeRowsInDb(tx, [
				{ criterionRowId: criterion.rowId, marks: { Pass: 1, Fail: 0 } },
			]),
		);

	const result = await db
		.transaction()
		.execute((tx) =>
			validateOptionsGradeInDb(tx, {
				criterionRowId: criterion.rowId,
				grade: { selectedLabel: "Withdrawn" },
			}),
		);

	expect(result).toEqual({
		valid: false,
		message:
			"That option is no longer available. Reload and choose another option.",
	});
});
