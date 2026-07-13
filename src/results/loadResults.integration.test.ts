import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { loadCriterionGradeRecordsFromDb } from "./loadResults.ts";

async function createGradeTarget(
	db: Kysely<Database>,
	projectRowId: number,
): Promise<{ id: string; rowId: number }> {
	const studentId = buildTestId("student");

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: studentId,
			lastName: "Overview",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const [id] = await nextGradeTargetIds(db, { projectRowId, count: 1 });
	if (id == null) throw new Error("Expected a generated id");

	const target = await db
		.insertInto("gradeTarget")
		.values({
			projectId: projectRowId,
			id,
			kind: "individual",
			studentRowId: studentRow.rowId,
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	return { id, rowId: target.rowId };
}

async function createRubric(
	db: Kysely<Database>,
	projectRowId: number,
	rubricId: string,
): Promise<number> {
	await db
		.insertInto("rubric")
		.values({
			projectId: projectRowId,
			id: rubricId,
			label: "Overview Q",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	return rubric.rowId;
}

async function createCheckCriterion(
	db: Kysely<Database>,
	{
		projectRowId,
		rubricRowId,
		criterionId,
	}: { projectRowId: number; rubricRowId: number; criterionId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			projectId: projectRowId,
			rubricId: rubricRowId,
			kind: "check",
			position: 0,
			label: "Check Criterion",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: rubric.rowId, marks: 1, falseMarks: 0 })
		.execute();

	return rubric.rowId;
}

async function createOptionsCriterion(
	db: Kysely<Database>,
	{
		projectRowId,
		rubricRowId,
		criterionId,
	}: { projectRowId: number; rubricRowId: number; criterionId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			projectId: projectRowId,
			rubricId: rubricRowId,
			kind: "options",
			position: 1,
			label: "Options Criterion",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const optionsCriterion = await db
		.insertInto("optionsCriterion")
		.values({ criterionId: rubric.rowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterionMark")
		.values([
			{ optionsCriterionId: optionsCriterion.id, label: "low", marks: 1 },
			{ optionsCriterionId: optionsCriterion.id, label: "high", marks: 3 },
		])
		.execute();

	return rubric.rowId;
}

async function createNumberCriterion(
	db: Kysely<Database>,
	{
		projectRowId,
		rubricRowId,
		criterionId,
	}: { projectRowId: number; rubricRowId: number; criterionId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			projectId: projectRowId,
			rubricId: rubricRowId,
			kind: "number",
			position: 2,
			label: "Number Criterion",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: rubric.rowId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return rubric.rowId;
}

async function addCheckGrade(
	db: Kysely<Database>,
	{
		gradeTargetRowId,
		criterionRowId,
		passed,
	}: { gradeTargetRowId: number; criterionRowId: number; passed: boolean },
): Promise<void> {
	const criterionGrade = await db
		.insertInto("criterionGrade")
		.values({ gradeTargetRowId, criterionId: criterionRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionGrade")
		.values({ criterionGradeId: criterionGrade.id, passed })
		.execute();
}

async function addOptionsGrade(
	db: Kysely<Database>,
	{
		gradeTargetRowId,
		criterionRowId,
		selectedLabel,
	}: {
		gradeTargetRowId: number;
		criterionRowId: number;
		selectedLabel: string;
	},
): Promise<void> {
	const criterionGrade = await db
		.insertInto("criterionGrade")
		.values({ gradeTargetRowId, criterionId: criterionRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterionGrade")
		.values({ criterionGradeId: criterionGrade.id, selectedLabel })
		.execute();
}

async function addNumberGrade(
	db: Kysely<Database>,
	{
		gradeTargetRowId,
		criterionRowId,
		score,
	}: { gradeTargetRowId: number; criterionRowId: number; score: number },
): Promise<void> {
	const criterionGrade = await db
		.insertInto("criterionGrade")
		.values({ gradeTargetRowId, criterionId: criterionRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numberCriterionGrade")
		.values({ criterionGradeId: criterionGrade.id, score })
		.execute();
}

test("loadCriterionGradeRecordsFromDb maps the per-type value column for boolean, ordinal and numerical grades", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Overview Types");

	const target = await createGradeTarget(db, project.rowId);
	const rubricRowId = await createRubric(
		db,
		project.rowId,
		buildTestId("rubric"),
	);

	const booleanRubricId = buildTestId("rubric-boolean");
	const optionsCriterionId = buildTestId("rubric-ordinal");
	const numericalRubricId = buildTestId("rubric-numerical");

	const checkCriterionRowId = await createCheckCriterion(db, {
		projectRowId: project.rowId,
		rubricRowId,
		criterionId: booleanRubricId,
	});
	const optionsCriterionRowId = await createOptionsCriterion(db, {
		projectRowId: project.rowId,
		rubricRowId,
		criterionId: optionsCriterionId,
	});
	const numberCriterionRowId = await createNumberCriterion(db, {
		projectRowId: project.rowId,
		rubricRowId,
		criterionId: numericalRubricId,
	});

	await addCheckGrade(db, {
		gradeTargetRowId: target.rowId,
		criterionRowId: checkCriterionRowId,
		passed: true,
	});
	await addOptionsGrade(db, {
		gradeTargetRowId: target.rowId,
		criterionRowId: optionsCriterionRowId,
		selectedLabel: "high",
	});
	await addNumberGrade(db, {
		gradeTargetRowId: target.rowId,
		criterionRowId: numberCriterionRowId,
		score: 7,
	});

	const records = await loadCriterionGradeRecordsFromDb(db, {
		projectId: project.id,
	});

	expect(records).toHaveLength(3);

	const byCriterionId = new Map(
		records.map((record) => [record.criterionId, record]),
	);

	expect(byCriterionId.get(booleanRubricId)).toEqual({
		gradeTargetId: target.id,
		criterionId: booleanRubricId,
		kind: "check",
		passed: true,
		selectedLabel: null,
		score: null,
	});
	expect(byCriterionId.get(optionsCriterionId)).toEqual({
		gradeTargetId: target.id,
		criterionId: optionsCriterionId,
		kind: "options",
		passed: null,
		selectedLabel: "high",
		score: null,
	});
	expect(byCriterionId.get(numericalRubricId)).toEqual({
		gradeTargetId: target.id,
		criterionId: numericalRubricId,
		kind: "number",
		passed: null,
		selectedLabel: null,
		score: 7,
	});
});

test("loadCriterionGradeRecordsFromDb excludes grade records from other projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Rubric Overview Isolation A");
	await using projectB = await createProject(db, "Rubric Overview Isolation B");

	const targetA = await createGradeTarget(db, projectA.rowId);
	const targetB = await createGradeTarget(db, projectB.rowId);

	const rubricRowIdA = await createRubric(
		db,
		projectA.rowId,
		buildTestId("criterion-a"),
	);
	const rubricRowIdB = await createRubric(
		db,
		projectB.rowId,
		buildTestId("criterion-b"),
	);

	const criterionIdA = buildTestId("criterion-a");
	const criterionIdB = buildTestId("criterion-b");

	const criterionRowIdA = await createCheckCriterion(db, {
		projectRowId: projectA.rowId,
		rubricRowId: rubricRowIdA,
		criterionId: criterionIdA,
	});
	const criterionRowIdB = await createCheckCriterion(db, {
		projectRowId: projectB.rowId,
		rubricRowId: rubricRowIdB,
		criterionId: criterionIdB,
	});

	await addCheckGrade(db, {
		gradeTargetRowId: targetA.rowId,
		criterionRowId: criterionRowIdA,
		passed: true,
	});
	await addCheckGrade(db, {
		gradeTargetRowId: targetB.rowId,
		criterionRowId: criterionRowIdB,
		passed: false,
	});

	const recordsA = await loadCriterionGradeRecordsFromDb(db, {
		projectId: projectA.id,
	});
	const recordsB = await loadCriterionGradeRecordsFromDb(db, {
		projectId: projectB.id,
	});

	expect(recordsA).toEqual([
		{
			gradeTargetId: targetA.id,
			criterionId: criterionIdA,
			kind: "check",
			passed: true,
			selectedLabel: null,
			score: null,
		},
	]);
	expect(recordsB).toEqual([
		{
			gradeTargetId: targetB.id,
			criterionId: criterionIdB,
			kind: "check",
			passed: false,
			selectedLabel: null,
			score: null,
		},
	]);
});
