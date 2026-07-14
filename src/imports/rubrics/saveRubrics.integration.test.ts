import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { ImportedRubrics } from "#imports/types.ts";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import {
	createBooleanRubricFixture,
	createGradedBooleanRubricFixture,
} from "#test/rubrics.ts";
import { prepareRubricImport } from "./prepareRubricImport.ts";
import { loadRubricImportContextFromDb } from "./rubricImportContext.ts";
import { saveRubricImportPlanInDb, saveRubrics } from "./saveRubrics.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

function makeRubrics(params: {
	rubricLabel: string;
	criterionLabel: string;
}): ImportedRubrics {
	return [
		{
			id: "q1",
			label: params.rubricLabel,
			criteria: [
				{
					id: "r1",
					kind: "check",
					label: params.criterionLabel,
					marks: 2,
					falseMarks: 0,
				},
			],
		},
	];
}

test("saveRubrics allows the same rubric and criterion ids in different grids", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Import Grid A");
	await using gridB = await createGrid(db, "Import Grid B");

	const resultA = await saveRubrics(
		{
			rubrics: makeRubrics({
				rubricLabel: "Rubric A",
				criterionLabel: "Criterion A",
			}),
			gridId: gridA.id,
		},
		{ db },
	);

	const resultB = await saveRubrics(
		{
			rubrics: makeRubrics({
				rubricLabel: "Rubric B",
				criterionLabel: "Criterion B",
			}),
			gridId: gridB.id,
		},
		{ db },
	);

	expect(resultA).toEqual({
		rubricCount: 1,
		criterionCount: 1,
		kindChangedCriterionCount: 0,
	});
	expect(resultB).toEqual({
		rubricCount: 1,
		criterionCount: 1,
		kindChangedCriterionCount: 0,
	});

	const rubrics = await db
		.selectFrom("rubric")
		.select(["gridRowId", "id", "label"])
		.where("id", "=", "q1")
		.orderBy("gridRowId", "asc")
		.execute();

	expect(rubrics).toHaveLength(2);
	expect(rubrics[0]?.label).toBe("Rubric A");
	expect(rubrics[1]?.label).toBe("Rubric B");

	const criteria = await db
		.selectFrom("criterion")
		.select(["gridRowId", "id", "label"])
		.where("id", "=", "r1")
		.orderBy("gridRowId", "asc")
		.execute();

	expect(criteria).toHaveLength(2);
	expect(criteria[0]?.label).toBe("Criterion A");
	expect(criteria[1]?.label).toBe("Criterion B");
});

test("saveRubrics updates only the target grid rows", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Isolation Grid A");
	await using gridB = await createGrid(db, "Isolation Grid B");

	await saveRubrics(
		{
			rubrics: makeRubrics({
				rubricLabel: "A initial",
				criterionLabel: "A criterion initial",
			}),
			gridId: gridA.id,
		},
		{ db },
	);

	await saveRubrics(
		{
			rubrics: makeRubrics({
				rubricLabel: "B initial",
				criterionLabel: "B criterion initial",
			}),
			gridId: gridB.id,
		},
		{ db },
	);

	await saveRubrics(
		{
			rubrics: makeRubrics({
				rubricLabel: "A updated",
				criterionLabel: "A criterion updated",
			}),
			gridId: gridA.id,
		},
		{ db },
	);

	const rubricA = await db
		.selectFrom("rubric")
		.select(["label"])
		.where("gridRowId", "=", gridA.rowId)
		.where("id", "=", "q1")
		.executeTakeFirstOrThrow();

	const rubricB = await db
		.selectFrom("rubric")
		.select(["label"])
		.where("gridRowId", "=", gridB.rowId)
		.where("id", "=", "q1")
		.executeTakeFirstOrThrow();

	const criterionA = await db
		.selectFrom("criterion")
		.select(["label"])
		.where("gridRowId", "=", gridA.rowId)
		.where("id", "=", "r1")
		.executeTakeFirstOrThrow();

	const criterionB = await db
		.selectFrom("criterion")
		.select(["label"])
		.where("gridRowId", "=", gridB.rowId)
		.where("id", "=", "r1")
		.executeTakeFirstOrThrow();

	expect(rubricA.label).toBe("A updated");
	expect(rubricB.label).toBe("B initial");
	expect(criterionA.label).toBe("A criterion updated");
	expect(criterionB.label).toBe("B criterion initial");
});

test("saveRubrics still upserts duplicate ids within the same grid", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Single Grid Upsert");
	const gridRowId = grid.rowId;

	await saveRubrics(
		{
			rubrics: makeRubrics({
				rubricLabel: "Before",
				criterionLabel: "Criterion before",
			}),
			gridId: grid.id,
		},
		{ db },
	);

	await saveRubrics(
		{
			rubrics: makeRubrics({
				rubricLabel: "After",
				criterionLabel: "Criterion after",
			}),
			gridId: grid.id,
		},
		{ db },
	);

	const rubrics = await db
		.selectFrom("rubric")
		.select(["id", "label"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", "q1")
		.execute();

	const criteria = await db
		.selectFrom("criterion")
		.select(["id", "label"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", "r1")
		.execute();

	expect(rubrics).toHaveLength(1);
	expect(criteria).toHaveLength(1);
	expect(rubrics[0]?.label).toBe("After");
	expect(criteria[0]?.label).toBe("Criterion after");
});

test("saveRubrics blocks a criterion type change when the criterion has linked grades", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Type Change Blocked Grid");
	const fixture = await createGradedBooleanRubricFixture(db, grid.rowId);

	const rubrics: ImportedRubrics = [
		{
			id: fixture.rubricId,
			label: "Boolean rubric",
			criteria: [
				{
					id: fixture.criterionId,
					kind: "options",
					label: "Correct",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	await expect(
		saveRubrics({ rubrics, gridId: grid.id }, { db }),
	).rejects.toThrow(
		`Criterion "${fixture.criterionId}" of rubric "${fixture.rubricId}" has 1 linked grades and cannot change type on import.`,
	);

	const criterion = await db
		.selectFrom("criterion")
		.select("kind")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	expect(criterion.kind).toBe("check");
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("saveRubrics allows a criterion type change when the criterion has no linked grades", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Type Change Allowed Grid");
	const fixture = await createBooleanRubricFixture(db, grid.rowId);

	const rubrics: ImportedRubrics = [
		{
			id: fixture.rubricId,
			label: "Boolean rubric",
			criteria: [
				{
					id: fixture.criterionId,
					kind: "options",
					label: "Correct",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	const result = await saveRubrics({ rubrics, gridId: grid.id }, { db });

	expect(result).toEqual({
		rubricCount: 1,
		criterionCount: 1,
		kindChangedCriterionCount: 1,
	});

	const criterion = await db
		.selectFrom("criterion")
		.select("kind")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	expect(criterion.kind).toBe("options");

	const optionsCriterionValues = await db
		.selectFrom("optionsCriterion")
		.innerJoin(
			"optionsCriterionMark",
			"optionsCriterionMark.optionsCriterionId",
			"optionsCriterion.id",
		)
		.innerJoin("criterion", "criterion.rowId", "optionsCriterion.criterionId")
		.select(["optionsCriterionMark.label", "optionsCriterionMark.marks"])
		.where("criterion.id", "=", fixture.criterionId)
		.execute();

	expect(optionsCriterionValues.map((value) => value.label).sort()).toEqual([
		"bad",
		"good",
	]);
});

test("saveRubrics blocks an imported criterion id that already belongs to another rubric", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Criterion Mismatch Grid");
	const fixture = await createBooleanRubricFixture(db, grid.rowId);

	const rubrics: ImportedRubrics = [
		{
			id: "another-rubric",
			label: "Another rubric",
			criteria: [
				{ id: fixture.criterionId, kind: "check", label: "Correct", marks: 2 },
			],
		},
	];

	await expect(
		saveRubrics({ rubrics, gridId: grid.id }, { db }),
	).rejects.toThrow(
		`Criterion "${fixture.criterionId}" already belongs to rubric "${fixture.rubricId}" and cannot be moved to rubric "another-rubric" on import.`,
	);

	const criterion = await db
		.selectFrom("criterion")
		.select("rubricId")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	expect(criterion.rubricId).toBe(fixture.rubricRowId);
});

test("saveRubrics wrapper invalidates rubric and grade tags after the import commits", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Import Rubrics Cache Grid");

	await saveRubrics(
		{
			rubrics: makeRubrics({ rubricLabel: "Q", criterionLabel: "R" }),
			gridId: grid.id,
		},
		{ db },
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		[`grids:${grid.id}:rubrics`, "max"],
		[`grids:${grid.id}:grades`, "max"],
		[`grids:${grid.id}:grades:all`, "max"],
	]);
});

// Lighter, overlap-invariant coverage (per the plan): assert the row-level
// contract only (no corruption, no thrown error, last-write-wins), not
// reported counts. Targets the criterion delete-then-recreate path on a type
// change (`saveRubrics.ts`), the spot most plausible to misbehave since the
// subtype tables (boolean/ordinal/numerical criterion) must never end up with
// stale rows for the previous type.
test("saveRubricImportPlanInDb keeps a single criterion definition when two imports race the same criterion type change", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Concurrency Rubric Import Grid");
	const fixture = await createBooleanRubricFixture(db, grid.rowId);

	function makeOrdinalImport(marks: Record<string, number>): ImportedRubrics {
		return [
			{
				id: fixture.rubricId,
				label: "Boolean rubric",
				criteria: [
					{ id: fixture.criterionId, kind: "options", label: "Correct", marks },
				],
			},
		];
	}

	const rubricsToMarksAB = makeOrdinalImport({ good: 1, bad: 0 });
	const rubricsToMarksXY = makeOrdinalImport({ yes: 2, no: 0 });

	// Both plans are built against the same pre-race snapshot (criterion still
	// boolean, no linked grades), mirroring two graders importing the
	// same in-flight change before either write lands.
	const [contextAB, contextXY] = await Promise.all([
		loadRubricImportContextFromDb(db, {
			rubrics: rubricsToMarksAB,
			gridId: grid.id,
		}),
		loadRubricImportContextFromDb(db, {
			rubrics: rubricsToMarksXY,
			gridId: grid.id,
		}),
	]);

	const planAB = prepareRubricImport({
		rubrics: rubricsToMarksAB,
		context: contextAB,
	});
	const planXY = prepareRubricImport({
		rubrics: rubricsToMarksXY,
		context: contextXY,
	});

	await runForcedInterleaving(db, {
		first: (tx) =>
			saveRubricImportPlanInDb(tx, { plan: planAB, gridId: grid.id }),
		second: (tx) =>
			saveRubricImportPlanInDb(tx, { plan: planXY, gridId: grid.id }),
	});

	const criterionRows = await db
		.selectFrom("criterion")
		.select(["rowId", "kind"])
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", fixture.criterionId)
		.execute();
	expect(criterionRows).toHaveLength(1);
	expect(criterionRows[0]?.kind).toBe("options");
	const criterionRowId = criterionRows[0]?.rowId;

	const [booleanRows, optionsCriterionRows] = await Promise.all([
		db
			.selectFrom("checkCriterion")
			.select("criterionId")
			.where("criterionId", "=", criterionRowId ?? -1)
			.execute(),
		db
			.selectFrom("optionsCriterion")
			.select("id")
			.where("criterionId", "=", criterionRowId ?? -1)
			.execute(),
	]);
	expect(booleanRows).toHaveLength(0);
	expect(optionsCriterionRows).toHaveLength(1);

	const ordinalValues = await db
		.selectFrom("optionsCriterionMark")
		.select("label")
		.where("optionsCriterionId", "=", optionsCriterionRows[0]?.id ?? -1)
		.execute();
	const labels = ordinalValues.map((value) => value.label).sort();

	expect([
		["bad", "good"],
		["no", "yes"],
	]).toContainEqual(labels);

	// Documents current behavior, not a committed policy: the writer that
	// commits last (the second writer, here) wins.
	expect(labels).toEqual(["no", "yes"]);
});
