import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import {
	allGradesTag,
	allRubricsTag,
	gradeCompletionByRubricTag,
} from "#db/cacheTags.ts";
import {
	buildTestId,
	createTestDb,
	inTransaction,
} from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import {
	createGradedCheckRubricFixture,
	createOptionsRubricFixture,
	createRubric,
	getRubricPositions,
} from "#test/rubrics.ts";
import {
	deleteRubricDefinition,
	deleteRubricDefinitionInDb,
	reorderRubrics,
	reorderRubricsInDb,
	saveRubricDefinition,
	saveRubricDefinitionInDb,
} from "./rubricDefinitionMutations.ts";

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

test("saveRubricDefinitionInDb persists inside a caller transaction and rolls back with it", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Save Rollback Grid");
	const rubricId = buildTestId("rubric-primitive");

	await expect(
		db.transaction().execute(async (tx) => {
			await saveRubricDefinitionInDb(tx, {
				input: {
					id: rubricId,
					label: "Inside transaction",
					criteria: [
						{
							id: buildTestId("criterion"),
							kind: "check",
							label: "Correct",
							marks: 2,
							falseMarks: 0,
						},
					],
				},
				gridId: grid.id,
			});

			const insideTransaction = await tx
				.selectFrom("rubric")
				.select("id")
				.where("id", "=", rubricId)
				.execute();
			expect(insideTransaction).toHaveLength(1);

			throw new Error("force rollback");
		}),
	).rejects.toThrow("force rollback");

	const afterRollback = await db
		.selectFrom("rubric")
		.select("id")
		.where("id", "=", rubricId)
		.execute();
	expect(afterRollback).toHaveLength(0);
});

test("saveRubricDefinitionInDb renames rubric id while preserving linked grades", async () => {
	await using db = await createTestDb();
	const { updateTag } = await import("next/cache");
	await using grid = await createGrid(db, "Save Rename Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);
	const renamedRubricId = buildTestId("rubric-renamed");

	const result = await inTransaction(db, (tx) =>
		saveRubricDefinitionInDb(tx, {
			input: {
				originalId: fixture.rubricId,
				id: renamedRubricId,
				label: "Renamed rubric",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: fixture.criterionId,
						kind: "check",
						label: "Correct",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			gridId: grid.id,
		}),
	);

	expect(result.id).toBe(renamedRubricId);
	// A DB Primitive never invalidates cache — that is the wrapper's job.
	expect(updateTag).not.toHaveBeenCalled();

	const rubricRow = await db
		.selectFrom("rubric")
		.select(["id", "rowId"])
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", renamedRubricId)
		.executeTakeFirstOrThrow();

	expect(rubricRow.rowId).toBe(fixture.rubricRowId);

	// The criterion grade survives the rubric rename, still linked to its
	// criterion (and through it to the renamed rubric).
	const criterionGrade = await db
		.selectFrom("criterionGrade")
		.select(["id", "criterionId"])
		.where("id", "=", fixture.criterionGradeId)
		.executeTakeFirstOrThrow();

	expect(criterionGrade.criterionId).toBe(fixture.criterionRowId);
});

test("saveRubricDefinitionInDb replaces criterion subtype data when criterion kind changes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Save Type Change Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);

	const replacedCriterionId = buildTestId("criterion-number");

	await inTransaction(db, (tx) =>
		saveRubricDefinitionInDb(tx, {
			input: {
				originalId: fixture.rubricId,
				id: fixture.rubricId,
				label: "Type-changed rubric",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: replacedCriterionId,
						kind: "number",
						label: "Value",
						minValue: 0,
						maxValue: 10,
						minMarks: 0,
						maxMarks: 5,
						reversed: false,
					},
				],
			},
			gridId: grid.id,
		}),
	);

	const oldCriterion = await db
		.selectFrom("criterion")
		.select("rowId")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", fixture.criterionId)
		.execute();

	expect(oldCriterion).toHaveLength(0);

	const newCriterion = await db
		.selectFrom("criterion")
		.select(["rowId", "kind"])
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", replacedCriterionId)
		.executeTakeFirstOrThrow();

	expect(newCriterion.kind).toBe("number");

	const checkSubtypeRows = await db
		.selectFrom("checkCriterion")
		.select("id")
		.where("criterionId", "=", fixture.criterionRowId)
		.execute();

	const numberSubtypeRows = await db
		.selectFrom("numberCriterion")
		.select(["criterionId", "minValue", "maxValue"])
		.where("criterionId", "=", newCriterion.rowId)
		.execute();

	const linkedCriterionGrades = await db
		.selectFrom("criterionGrade")
		.select("id")
		.where("criterionId", "=", fixture.criterionRowId)
		.execute();

	expect(checkSubtypeRows).toHaveLength(0);
	expect(numberSubtypeRows).toHaveLength(1);
	expect(linkedCriterionGrades).toHaveLength(0);
});

test("saveRubricDefinitionInDb removes stale criteria that are no longer referenced", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Save Stale Criterion Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);

	const staleCriterionId = buildTestId("criterion-stale");

	await inTransaction(db, async (tx) => {
		await saveRubricDefinitionInDb(tx, {
			input: {
				originalId: fixture.rubricId,
				id: fixture.rubricId,
				label: "With stale criterion",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: fixture.criterionId,
						kind: "check",
						label: "Primary",
						marks: 2,
						falseMarks: 0,
					},
					{
						id: staleCriterionId,
						kind: "check",
						label: "Temporary",
						marks: 1,
						falseMarks: 0,
					},
				],
			},
			gridId: grid.id,
		});

		await saveRubricDefinitionInDb(tx, {
			input: {
				originalId: fixture.rubricId,
				id: fixture.rubricId,
				label: "Stale removed",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: fixture.criterionId,
						kind: "check",
						label: "Primary",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			gridId: grid.id,
		});
	});

	const staleCriterionRows = await db
		.selectFrom("criterion")
		.select("id")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", staleCriterionId)
		.execute();

	const remainingCriteria = await db
		.selectFrom("criterion")
		.select("id")
		.where("gridRowId", "=", grid.rowId)
		.where("rubricId", "=", fixture.rubricRowId)
		.execute();

	expect(staleCriterionRows).toHaveLength(0);
	expect(remainingCriteria.map((criterion) => criterion.id)).toEqual([
		fixture.criterionId,
	]);
});

test("saveRubricDefinitionInDb replaces options criterion values using the provided label set", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Save Options Values Grid");
	const fixture = await createOptionsRubricFixture(db, grid.rowId);

	await inTransaction(db, (tx) =>
		saveRubricDefinitionInDb(tx, {
			input: {
				originalId: fixture.rubricId,
				id: fixture.rubricId,
				label: "Options updated",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: fixture.criterionId,
						kind: "options",
						label: "Options",
						marks: { B: 2.5, C: 1 },
					},
				],
			},
			gridId: grid.id,
		}),
	);

	const criterionRow = await db
		.selectFrom("criterion")
		.select("rowId")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	const optionsCriterion = await db
		.selectFrom("optionsCriterion")
		.select("id")
		.where("criterionId", "=", criterionRow.rowId)
		.executeTakeFirstOrThrow();

	const values = await db
		.selectFrom("optionsCriterionMark")
		.select(["label", "marks"])
		.where("optionsCriterionId", "=", optionsCriterion.id)
		.orderBy("label", "asc")
		.execute();

	const normalizedValues = values.map((value) => ({
		label: value.label,
		marks: Number(value.marks),
	}));

	expect(normalizedValues).toEqual([
		{ label: "B", marks: 2.5 },
		{ label: "C", marks: 1 },
	]);
});

test("deleteRubricDefinitionInDb reports deletion and cascades linked grades", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Delete Cascade Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);

	const result = await inTransaction(db, (tx) =>
		deleteRubricDefinitionInDb(tx, {
			rubricId: fixture.rubricId,
			gridId: grid.id,
		}),
	);
	expect(result).toEqual({ deleted: true });

	const rubricRows = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", fixture.rubricId)
		.execute();

	const criterionGradeRows = await db
		.selectFrom("criterionGrade")
		.select("id")
		.where("id", "=", fixture.criterionGradeId)
		.execute();

	expect(rubricRows).toHaveLength(0);
	expect(criterionGradeRows).toHaveLength(0);
});

test("deleteRubricDefinitionInDb returns deleted false when no rubric matches in grid", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Delete Missing Grid");
	const missingId = buildTestId("rubric-missing");

	const result = await inTransaction(db, (tx) =>
		deleteRubricDefinitionInDb(tx, { rubricId: missingId, gridId: grid.id }),
	);

	expect(result).toEqual({ deleted: false });
});

test("deleteRubricDefinitionInDb deletes a rubric that has no grades", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Delete Standalone Grid");
	const rubric = await createRubric(db, grid.rowId, 0);

	const result = await inTransaction(db, (tx) =>
		deleteRubricDefinitionInDb(tx, { rubricId: rubric.id, gridId: grid.id }),
	);
	expect(result).toEqual({ deleted: true });

	const rubricRows = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", rubric.id)
		.execute();

	expect(rubricRows).toHaveLength(0);
});

test("reorderRubricsInDb updates positions for the provided rubrics", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Reorder Grid");
	const first = await createRubric(db, grid.rowId, 0);
	const second = await createRubric(db, grid.rowId, 1);
	const third = await createRubric(db, grid.rowId, 2);

	await inTransaction(db, (tx) =>
		reorderRubricsInDb(tx, {
			updates: [
				{ id: third.id, position: 0 },
				{ id: first.id, position: 1 },
				{ id: second.id, position: 2 },
			],
			gridId: grid.id,
		}),
	);

	const positions = await getRubricPositions(db, grid.rowId);
	expect(positions).toEqual({ [third.id]: 0, [first.id]: 1, [second.id]: 2 });
});

test("reorderRubricsInDb leaves rubrics outside the update list untouched", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Reorder Partial Grid");
	const first = await createRubric(db, grid.rowId, 0);
	const second = await createRubric(db, grid.rowId, 1);
	const untouched = await createRubric(db, grid.rowId, 2);

	await inTransaction(db, (tx) =>
		reorderRubricsInDb(tx, {
			updates: [
				{ id: first.id, position: 1 },
				{ id: second.id, position: 0 },
			],
			gridId: grid.id,
		}),
	);

	const positions = await getRubricPositions(db, grid.rowId);
	expect(positions).toEqual({
		[first.id]: 1,
		[second.id]: 0,
		[untouched.id]: 2,
	});
});

test("reorderRubricsInDb only affects rubrics in the given grid", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Reorder Scoped Grid");
	await using otherGrid = await createGrid(db, "Reorder Other Grid");

	const rubric = await createRubric(db, grid.rowId, 0);
	const otherRubric = await createRubric(db, otherGrid.rowId, 0);

	await inTransaction(db, (tx) =>
		reorderRubricsInDb(tx, {
			updates: [{ id: rubric.id, position: 5 }],
			gridId: grid.id,
		}),
	);

	const positions = await getRubricPositions(db, grid.rowId);
	expect(positions).toEqual({ [rubric.id]: 5 });

	const otherPositions = await getRubricPositions(db, otherGrid.rowId);
	expect(otherPositions).toEqual({ [otherRubric.id]: 0 });
});

test("reorderRubricsInDb does nothing when given no updates", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Reorder Empty Grid");
	const rubric = await createRubric(db, grid.rowId, 0);

	await inTransaction(db, (tx) =>
		reorderRubricsInDb(tx, { updates: [], gridId: grid.id }),
	);

	const positions = await getRubricPositions(db, grid.rowId);
	expect(positions).toEqual({ [rubric.id]: 0 });
});

test("reorderRubricsInDb throws and changes nothing when an id is not found", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Reorder Missing Grid");
	const existing = await createRubric(db, grid.rowId, 0);
	const missingId = buildTestId("rubric-missing");

	await expect(
		db.transaction().execute((tx) =>
			reorderRubricsInDb(tx, {
				updates: [
					{ id: existing.id, position: 1 },
					{ id: missingId, position: 0 },
				],
				gridId: grid.id,
			}),
		),
	).rejects.toThrow(missingId);

	const positions = await getRubricPositions(db, grid.rowId);
	expect(positions).toEqual({ [existing.id]: 0 });
});

test("reorderRubricsInDb throws when the same id is provided more than once", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Reorder Duplicate Grid");
	const rubric = await createRubric(db, grid.rowId, 0);

	await expect(
		inTransaction(db, (tx) =>
			reorderRubricsInDb(tx, {
				updates: [
					{ id: rubric.id, position: 1 },
					{ id: rubric.id, position: 2 },
				],
				gridId: grid.id,
			}),
		),
	).rejects.toThrow(rubric.id);

	const positions = await getRubricPositions(db, grid.rowId);
	expect(positions).toEqual({ [rubric.id]: 0 });
});

test("saveRubricDefinition wrapper updates the rubric list read-your-writes and revalidates grade tags after commit", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Save Cache Grid");
	const rubricId = buildTestId("rubric");

	await saveRubricDefinition(
		{
			input: {
				id: rubricId,
				label: "Cached rubric",
				criteria: [
					{
						id: buildTestId("criterion"),
						kind: "check",
						label: "Correct",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			gridId: grid.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([allRubricsTag({ gridId: grid.id })]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		allGradesTag({ gridId: grid.id }),
		gradeCompletionByRubricTag({ gridId: grid.id, rubricId }),
	]);
});

test("saveRubricDefinition wrapper revalidates the previous rubric's completion when the id changes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Save Rename Cache Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);
	const renamedRubricId = buildTestId("rubric-renamed");

	await saveRubricDefinition(
		{
			input: {
				originalId: fixture.rubricId,
				id: renamedRubricId,
				label: "Renamed rubric",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: fixture.criterionId,
						kind: "check",
						label: "Correct",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			gridId: grid.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([allRubricsTag({ gridId: grid.id })]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		allGradesTag({ gridId: grid.id }),
		gradeCompletionByRubricTag({ gridId: grid.id, rubricId: renamedRubricId }),
		gradeCompletionByRubricTag({ gridId: grid.id, rubricId: fixture.rubricId }),
	]);
});

test("saveRubricDefinition wrapper does not invalidate when persistence throws", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Save Cache Throw Grid");

	await expect(
		saveRubricDefinition(
			{ input: { id: "   ", criteria: [] }, gridId: grid.id },
			{ db },
		),
	).rejects.toThrow();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("deleteRubricDefinition wrapper updates the rubric list read-your-writes and revalidates grade tags", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Delete Cache Grid");
	const rubric = await createRubric(db, grid.rowId, 0);

	await deleteRubricDefinition(
		{ rubricId: rubric.id, gridId: grid.id },
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([allRubricsTag({ gridId: grid.id })]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		allGradesTag({ gridId: grid.id }),
		gradeCompletionByRubricTag({ gridId: grid.id, rubricId: rubric.id }),
	]);
});

test("reorderRubrics wrapper updates the rubrics tag read-your-writes after commit", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Reorder Cache Grid");
	const first = await createRubric(db, grid.rowId, 0);
	const second = await createRubric(db, grid.rowId, 1);

	await reorderRubrics(
		{
			updates: [
				{ id: first.id, position: 1 },
				{ id: second.id, position: 0 },
			],
			gridId: grid.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([allRubricsTag({ gridId: grid.id })]);
	expect(revalidateTag).not.toHaveBeenCalled();
});
