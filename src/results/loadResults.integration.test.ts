import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import { loadCriterionGradeRecordsFromDb } from "./loadResults.ts";

async function createGradeTarget(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<{ id: string; rowId: number }> {
	const studentId = buildTestId("student");

	await db
		.insertInto("student")
		.values({
			gridRowId: gridRowId,
			id: studentId,
			lastName: "Overview",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const [id] = await nextGradeTargetIds(db, { gridRowId, count: 1 });
	if (id == null) throw new Error("Expected a generated id");

	const target = await db
		.insertInto("gradeTarget")
		.values({ gridRowId: gridRowId, id })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("gradeTargetStudent")
		.values({ gradeTargetRowId: target.rowId, studentRowId: studentRow.rowId })
		.execute();

	return { id, rowId: target.rowId };
}

async function createRubric(
	db: Kysely<Database>,
	gridRowId: number,
	rubricId: string,
): Promise<number> {
	await db
		.insertInto("rubric")
		.values({
			gridRowId: gridRowId,
			id: rubricId,
			label: "Overview Q",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	return rubric.rowId;
}

async function createCheckCriterion(
	db: Kysely<Database>,
	{
		gridRowId,
		rubricRowId,
		criterionId,
	}: { gridRowId: number; rubricRowId: number; criterionId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			gridRowId: gridRowId,
			rubricRowId: rubricRowId,
			kind: "check",
			position: 0,
			label: "Check Criterion",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterion")
		.values({ criterionRowId: rubric.rowId, marks: 1, falseMarks: 0 })
		.execute();

	return rubric.rowId;
}

async function createOptionsCriterion(
	db: Kysely<Database>,
	{
		gridRowId,
		rubricRowId,
		criterionId,
	}: { gridRowId: number; rubricRowId: number; criterionId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			gridRowId: gridRowId,
			rubricRowId: rubricRowId,
			kind: "options",
			position: 1,
			label: "Options Criterion",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterion")
		.values({ criterionRowId: rubric.rowId })
		.execute();

	await db
		.insertInto("optionsCriterionMark")
		.values([
			{ criterionRowId: rubric.rowId, label: "low", marks: 1 },
			{ criterionRowId: rubric.rowId, label: "high", marks: 3 },
		])
		.execute();

	return rubric.rowId;
}

async function createNumberCriterion(
	db: Kysely<Database>,
	{
		gridRowId,
		rubricRowId,
		criterionId,
	}: { gridRowId: number; rubricRowId: number; criterionId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			gridRowId: gridRowId,
			rubricRowId: rubricRowId,
			kind: "number",
			position: 2,
			label: "Number Criterion",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionRowId: rubric.rowId,
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return rubric.rowId;
}

async function addCheckGrade(
	db: Kysely<Database>,
	{
		gridRowId,
		gradeTargetRowId,
		criterionRowId,
		passed,
	}: {
		gridRowId: number;
		gradeTargetRowId: number;
		criterionRowId: number;
		passed: boolean;
	},
): Promise<void> {
	await db
		.insertInto("criterionGrade")
		.values({ gridRowId, gradeTargetRowId, criterionRowId })
		.execute();

	await db
		.insertInto("checkCriterionGrade")
		.values({ gradeTargetRowId, criterionRowId, passed })
		.execute();
}

async function addOptionsGrade(
	db: Kysely<Database>,
	{
		gridRowId,
		gradeTargetRowId,
		criterionRowId,
		selectedLabel,
	}: {
		gridRowId: number;
		gradeTargetRowId: number;
		criterionRowId: number;
		selectedLabel: string;
	},
): Promise<void> {
	await db
		.insertInto("criterionGrade")
		.values({ gridRowId, gradeTargetRowId, criterionRowId })
		.execute();

	await db
		.insertInto("optionsCriterionGrade")
		.values({ gradeTargetRowId, criterionRowId, selectedLabel })
		.execute();
}

async function addNumberGrade(
	db: Kysely<Database>,
	{
		gridRowId,
		gradeTargetRowId,
		criterionRowId,
		value,
	}: {
		gridRowId: number;
		gradeTargetRowId: number;
		criterionRowId: number;
		value: number;
	},
): Promise<void> {
	await db
		.insertInto("criterionGrade")
		.values({ gridRowId, gradeTargetRowId, criterionRowId })
		.execute();

	await db
		.insertInto("numberCriterionGrade")
		.values({ gradeTargetRowId, criterionRowId, value })
		.execute();
}

test("loadCriterionGradeRecordsFromDb maps the per-kind value column for check, options and number grades", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Rubric Overview Types");

	const target = await createGradeTarget(db, grid.rowId);
	const rubricRowId = await createRubric(db, grid.rowId, buildTestId("rubric"));

	const checkCriterionId = buildTestId("criterion-check");
	const optionsCriterionId = buildTestId("criterion-options");
	const numberCriterionId = buildTestId("criterion-number");

	const checkCriterionRowId = await createCheckCriterion(db, {
		gridRowId: grid.rowId,
		rubricRowId,
		criterionId: checkCriterionId,
	});
	const optionsCriterionRowId = await createOptionsCriterion(db, {
		gridRowId: grid.rowId,
		rubricRowId,
		criterionId: optionsCriterionId,
	});
	const numberCriterionRowId = await createNumberCriterion(db, {
		gridRowId: grid.rowId,
		rubricRowId,
		criterionId: numberCriterionId,
	});

	await addCheckGrade(db, {
		gridRowId: grid.rowId,
		gradeTargetRowId: target.rowId,
		criterionRowId: checkCriterionRowId,
		passed: true,
	});
	await addOptionsGrade(db, {
		gridRowId: grid.rowId,
		gradeTargetRowId: target.rowId,
		criterionRowId: optionsCriterionRowId,
		selectedLabel: "high",
	});
	await addNumberGrade(db, {
		gridRowId: grid.rowId,
		gradeTargetRowId: target.rowId,
		criterionRowId: numberCriterionRowId,
		value: 7,
	});

	const records = await loadCriterionGradeRecordsFromDb(db, {
		gridId: grid.id,
	});

	expect(records).toHaveLength(3);

	const byCriterionId = new Map(
		records.map((record) => [record.criterionId, record]),
	);

	expect(byCriterionId.get(checkCriterionId)).toEqual({
		gradeTargetId: target.id,
		criterionId: checkCriterionId,
		kind: "check",
		passed: true,
		selectedLabel: null,
		value: null,
	});
	expect(byCriterionId.get(optionsCriterionId)).toEqual({
		gradeTargetId: target.id,
		criterionId: optionsCriterionId,
		kind: "options",
		passed: null,
		selectedLabel: "high",
		value: null,
	});
	expect(byCriterionId.get(numberCriterionId)).toEqual({
		gradeTargetId: target.id,
		criterionId: numberCriterionId,
		kind: "number",
		passed: null,
		selectedLabel: null,
		value: 7,
	});
});

test("loadCriterionGradeRecordsFromDb excludes grade records from other grids", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Rubric Overview Isolation A");
	await using gridB = await createGrid(db, "Rubric Overview Isolation B");

	const targetA = await createGradeTarget(db, gridA.rowId);
	const targetB = await createGradeTarget(db, gridB.rowId);

	const rubricRowIdA = await createRubric(
		db,
		gridA.rowId,
		buildTestId("criterion-a"),
	);
	const rubricRowIdB = await createRubric(
		db,
		gridB.rowId,
		buildTestId("criterion-b"),
	);

	const criterionIdA = buildTestId("criterion-a");
	const criterionIdB = buildTestId("criterion-b");

	const criterionRowIdA = await createCheckCriterion(db, {
		gridRowId: gridA.rowId,
		rubricRowId: rubricRowIdA,
		criterionId: criterionIdA,
	});
	const criterionRowIdB = await createCheckCriterion(db, {
		gridRowId: gridB.rowId,
		rubricRowId: rubricRowIdB,
		criterionId: criterionIdB,
	});

	await addCheckGrade(db, {
		gridRowId: gridA.rowId,
		gradeTargetRowId: targetA.rowId,
		criterionRowId: criterionRowIdA,
		passed: true,
	});
	await addCheckGrade(db, {
		gridRowId: gridB.rowId,
		gradeTargetRowId: targetB.rowId,
		criterionRowId: criterionRowIdB,
		passed: false,
	});

	const recordsA = await loadCriterionGradeRecordsFromDb(db, {
		gridId: gridA.id,
	});
	const recordsB = await loadCriterionGradeRecordsFromDb(db, {
		gridId: gridB.id,
	});

	expect(recordsA).toEqual([
		{
			gradeTargetId: targetA.id,
			criterionId: criterionIdA,
			kind: "check",
			passed: true,
			selectedLabel: null,
			value: null,
		},
	]);
	expect(recordsB).toEqual([
		{
			gradeTargetId: targetB.id,
			criterionId: criterionIdB,
			kind: "check",
			passed: false,
			selectedLabel: null,
			value: null,
		},
	]);
});
