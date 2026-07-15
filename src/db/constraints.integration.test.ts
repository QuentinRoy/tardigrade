import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import type { Database } from "./generated/database.ts";

type CriterionRowIds = { check: number; options: number; number: number };

type GradeConstraintFixture = {
	optionsCriterionGradeIds: { primary: number; secondary: number };
	numberCriterionGradeIds: { primary: number; secondary: number };
};

async function createGradeConstraintFixture(
	db: Kysely<Database>,
	gridId: string,
): Promise<GradeConstraintFixture> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = grid.rowId;

	const rubricId = buildTestId("rubric");

	await db
		.insertInto("rubric")
		.values({
			gridRowId: gridRowId,
			id: rubricId,
			label: "Constraint rubric",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const insertedCriteria = await db
		.insertInto("criterion")
		.values([
			{
				gridRowId: gridRowId,
				id: buildTestId("criterion-check"),
				rubricId: rubric.rowId,
				kind: "check",
				position: 0,
				label: "Check criterion",
			},
			{
				gridRowId: gridRowId,
				id: buildTestId("criterion-options"),
				rubricId: rubric.rowId,
				kind: "options",
				position: 1,
				label: "Options criterion",
			},
			{
				gridRowId: gridRowId,
				id: buildTestId("criterion-number"),
				rubricId: rubric.rowId,
				kind: "number",
				position: 2,
				label: "Number criterion",
			},
		])
		.returning(["id", "rowId", "kind"])
		.execute();

	const criterionRowsByKind = new Map(
		insertedCriteria.map((criterion) => [criterion.kind, criterion.rowId]),
	);

	const checkCriterionId = criterionRowsByKind.get("check");
	const optionsCriterionId = criterionRowsByKind.get("options");
	const numberCriterionId = criterionRowsByKind.get("number");

	if (
		checkCriterionId == null ||
		optionsCriterionId == null ||
		numberCriterionId == null
	) {
		throw new Error("Expected all criterion rows to be created.");
	}

	const studentAId = buildTestId("student-a");
	const studentBId = buildTestId("student-b");

	await db
		.insertInto("student")
		.values([
			{
				gridRowId: gridRowId,
				id: studentAId,
				firstName: "Primary",
				lastName: "Student",
			},
			{
				gridRowId: gridRowId,
				id: studentBId,
				firstName: "Secondary",
				lastName: "Student",
			},
		])
		.execute();

	const students = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "in", [studentAId, studentBId])
		.execute();

	const studentRowsById = new Map(
		students.map((student) => [student.id, student]),
	);

	const studentA = studentRowsById.get(studentAId);
	const studentB = studentRowsById.get(studentBId);

	if (studentA == null || studentB == null) {
		throw new Error("Expected student rows to be created.");
	}

	const gradeTargetIds = await nextGradeTargetIds(db, { gridRowId, count: 2 });
	const [primaryTargetId, secondaryTargetId] = gradeTargetIds;
	if (primaryTargetId == null || secondaryTargetId == null) {
		throw new Error("Expected generated grade target ids.");
	}

	const insertedTargets = await db
		.insertInto("gradeTarget")
		.values([
			{
				gridRowId: gridRowId,
				id: primaryTargetId,
				kind: "individual",
				studentRowId: studentA.rowId,
			},
			{
				gridRowId: gridRowId,
				id: secondaryTargetId,
				kind: "individual",
				studentRowId: studentB.rowId,
			},
		])
		.returning("rowId")
		.execute();

	const [primaryTarget, secondaryTarget] = insertedTargets;

	if (primaryTarget == null || secondaryTarget == null) {
		throw new Error("Expected grade target rows to be created.");
	}

	const insertedCriterionGrades = await db
		.insertInto("criterionGrade")
		.values([
			{
				gradeTargetRowId: primaryTarget.rowId,
				criterionId: optionsCriterionId,
			},
			{
				gradeTargetRowId: secondaryTarget.rowId,
				criterionId: optionsCriterionId,
			},
			{ gradeTargetRowId: primaryTarget.rowId, criterionId: numberCriterionId },
			{
				gradeTargetRowId: secondaryTarget.rowId,
				criterionId: numberCriterionId,
			},
		])
		.returning(["id", "gradeTargetRowId", "criterionId"])
		.execute();

	const optionsCriterionGrades = insertedCriterionGrades.filter(
		(criterionGrade) => criterionGrade.criterionId === optionsCriterionId,
	);

	const numberCriterionGrades = insertedCriterionGrades.filter(
		(criterionGrade) => criterionGrade.criterionId === numberCriterionId,
	);

	const [optionsPrimary, optionsSecondary] = optionsCriterionGrades;
	const [numberPrimary, numberSecondary] = numberCriterionGrades;

	if (
		optionsPrimary == null ||
		optionsSecondary == null ||
		numberPrimary == null ||
		numberSecondary == null
	) {
		throw new Error(
			"Expected criterion grade rows for options and number criteria.",
		);
	}

	const optionsCriterion = await db
		.insertInto("optionsCriterion")
		.values({ criterionId: optionsCriterionId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterionMark")
		.values([
			{ optionsCriterionId: optionsCriterion.id, label: "A", marks: 4 },
			{ optionsCriterionId: optionsCriterion.id, label: "B", marks: 2 },
		])
		.execute();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: numberCriterionId,
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		})
		.execute();

	return {
		optionsCriterionGradeIds: {
			primary: optionsPrimary.id,
			secondary: optionsSecondary.id,
		},
		numberCriterionGradeIds: {
			primary: numberPrimary.id,
			secondary: numberSecondary.id,
		},
	};
}

async function createSubtypeConstraintFixture(
	db: Kysely<Database>,
	gridId: string,
): Promise<CriterionRowIds> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = grid.rowId;

	const rubricId = buildTestId("rubric-subtype");

	await db
		.insertInto("rubric")
		.values({
			gridRowId: gridRowId,
			id: rubricId,
			label: "Subtype rubric",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const insertedCriteria = await db
		.insertInto("criterion")
		.values([
			{
				gridRowId: gridRowId,
				id: buildTestId("subtype-criterion-check"),
				rubricId: rubric.rowId,
				kind: "check",
				position: 0,
				label: "Subtype check criterion",
			},
			{
				gridRowId: gridRowId,
				id: buildTestId("subtype-criterion-options"),
				rubricId: rubric.rowId,
				kind: "options",
				position: 1,
				label: "Subtype options criterion",
			},
			{
				gridRowId: gridRowId,
				id: buildTestId("subtype-criterion-number"),
				rubricId: rubric.rowId,
				kind: "number",
				position: 2,
				label: "Subtype number criterion",
			},
		])
		.returning(["kind", "rowId"])
		.execute();

	const criterionRowsByKind = new Map(
		insertedCriteria.map((criterion) => [criterion.kind, criterion.rowId]),
	);

	const checkCriterionId = criterionRowsByKind.get("check");
	const optionsCriterionId = criterionRowsByKind.get("options");
	const numberCriterionId = criterionRowsByKind.get("number");

	if (
		checkCriterionId == null ||
		optionsCriterionId == null ||
		numberCriterionId == null
	) {
		throw new Error(
			"Expected all subtype fixture criterion rows to be created.",
		);
	}

	return {
		check: checkCriterionId,
		options: optionsCriterionId,
		number: numberCriterionId,
	};
}

test("options criterion grades accept valid labels and roll back failed transactional writes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Constraint Options Grid");
	const fixture = await createGradeConstraintFixture(db, grid.id);

	await db
		.insertInto("optionsCriterionGrade")
		.values({
			criterionGradeId: fixture.optionsCriterionGradeIds.primary,
			selectedLabel: "A",
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("optionsCriterionGrade")
				.values({
					criterionGradeId: fixture.optionsCriterionGradeIds.secondary,
					selectedLabel: "B",
				})
				.execute();

			await trx
				.insertInto("optionsCriterionGrade")
				.values({
					criterionGradeId: fixture.optionsCriterionGradeIds.primary,
					selectedLabel: "INVALID",
				})
				.execute();
		}),
	).rejects.toThrow("selected_label");

	const persisted = await db
		.selectFrom("optionsCriterionGrade")
		.select(["criterionGradeId", "selectedLabel"])
		.where("criterionGradeId", "in", [
			fixture.optionsCriterionGradeIds.primary,
			fixture.optionsCriterionGradeIds.secondary,
		])
		.orderBy("criterionGradeId", "asc")
		.execute();

	expect(persisted).toEqual([
		{
			criterionGradeId: fixture.optionsCriterionGradeIds.primary,
			selectedLabel: "A",
		},
	]);
});

test("number criterion grades enforce value bounds and roll back failed transactional writes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Constraint Number Grid");
	const fixture = await createGradeConstraintFixture(db, grid.id);

	await db
		.insertInto("numberCriterionGrade")
		.values({
			criterionGradeId: fixture.numberCriterionGradeIds.primary,
			value: 7.5,
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("numberCriterionGrade")
				.values({
					criterionGradeId: fixture.numberCriterionGradeIds.secondary,
					value: 4,
				})
				.execute();

			await trx
				.insertInto("numberCriterionGrade")
				.values({
					criterionGradeId: fixture.numberCriterionGradeIds.primary,
					value: 11,
				})
				.execute();
		}),
	).rejects.toThrow("out of bounds");

	const persisted = await db
		.selectFrom("numberCriterionGrade")
		.select(["criterionGradeId", "value"])
		.where("criterionGradeId", "in", [
			fixture.numberCriterionGradeIds.primary,
			fixture.numberCriterionGradeIds.secondary,
		])
		.orderBy("criterionGradeId", "asc")
		.execute();

	const normalizedPersisted = persisted.map((row) => ({
		criterionGradeId: row.criterionGradeId,
		value: Number(row.value),
	}));

	expect(normalizedPersisted).toEqual([
		{ criterionGradeId: fixture.numberCriterionGradeIds.primary, value: 7.5 },
	]);
});

test("grade target owner/kind check rejects invalid rows and rolls back transactional writes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Constraint Grade Target Grid");

	const studentId = buildTestId("student");

	await db
		.insertInto("student")
		.values({
			gridRowId: grid.rowId,
			id: studentId,
			firstName: "Constraint",
			lastName: "Student",
		})
		.execute();

	const student = await db
		.selectFrom("student")
		.select("rowId")
		.where("gridRowId", "=", grid.rowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const group = await db
		.insertInto("group")
		.values({ gridRowId: grid.rowId, name: buildTestId("group") })
		.returning("id")
		.executeTakeFirstOrThrow();

	const [firstTargetId, secondTargetId, thirdTargetId] =
		await nextGradeTargetIds(db, { gridRowId: grid.rowId, count: 3 });
	if (
		firstTargetId == null ||
		secondTargetId == null ||
		thirdTargetId == null
	) {
		throw new Error("Expected generated grade target ids.");
	}

	await db
		.insertInto("gradeTarget")
		.values({
			gridRowId: grid.rowId,
			id: firstTargetId,
			kind: "individual",
			studentRowId: student.rowId,
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("gradeTarget")
				.values({
					gridRowId: grid.rowId,
					id: secondTargetId,
					kind: "group",
					groupRowId: group.id,
				})
				.execute();

			await trx
				.insertInto("gradeTarget")
				.values({
					gridRowId: grid.rowId,
					id: thirdTargetId,
					kind: "individual",
					groupRowId: group.id,
				})
				.execute();
		}),
	).rejects.toThrow("grade_target_kind_participant_check");

	const persisted = await db
		.selectFrom("gradeTarget")
		.select(["id", "kind", "studentRowId", "groupRowId"])
		.where("gridRowId", "=", grid.rowId)
		.execute();

	expect(persisted).toHaveLength(1);

	const onlyTarget = persisted[0];

	if (onlyTarget == null) {
		throw new Error("Expected one persisted grade target after rollback.");
	}

	expect(onlyTarget.kind).toBe("individual");
	expect(onlyTarget.studentRowId).toBe(student.rowId);
	expect(onlyTarget.groupRowId).toBeNull();
});

test("criterion subtype triggers reject mismatched subtype rows and roll back transactional writes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Constraint Subtype Grid");
	const criterionRowIds = await createSubtypeConstraintFixture(db, grid.id);

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: criterionRowIds.check, marks: 2, falseMarks: 0 })
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("optionsCriterion")
				.values({ criterionId: criterionRowIds.options })
				.execute();

			await trx
				.insertInto("checkCriterion")
				.values({
					criterionId: criterionRowIds.options,
					marks: 2,
					falseMarks: 0,
				})
				.execute();
		}),
	).rejects.toThrow("requires Criterion.kind check");

	const checkRows = await db
		.selectFrom("checkCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.options)
		.execute();

	const optionsRows = await db
		.selectFrom("optionsCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.options)
		.execute();

	const baselineCheckRows = await db
		.selectFrom("checkCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.check)
		.execute();

	expect(checkRows).toHaveLength(0);
	expect(optionsRows).toHaveLength(0);
	expect(baselineCheckRows).toHaveLength(1);
});

test("number criterion value range check rejects a collapsed or inverted range and rolls back transactional writes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Constraint Number Value Range Grid");
	const criterionRowIds = await createSubtypeConstraintFixture(db, grid.id);

	await expect(
		db
			.insertInto("numberCriterion")
			.values({
				criterionId: criterionRowIds.number,
				minValue: 5,
				maxValue: 5,
				minMarks: 0,
				maxMarks: 10,
				reversed: false,
			})
			.execute(),
	).rejects.toThrow("number_criterion_value_range_check");

	await expect(
		db
			.insertInto("numberCriterion")
			.values({
				criterionId: criterionRowIds.number,
				minValue: 10,
				maxValue: 5,
				minMarks: 0,
				maxMarks: 10,
				reversed: false,
			})
			.execute(),
	).rejects.toThrow("number_criterion_value_range_check");

	const persisted = await db
		.selectFrom("numberCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.number)
		.execute();

	expect(persisted).toHaveLength(0);
});

test("number criterion marks range check rejects inverted marks and rolls back transactional writes", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Constraint Number Marks Range Grid");
	const criterionRowIds = await createSubtypeConstraintFixture(db, grid.id);

	await expect(
		db
			.insertInto("numberCriterion")
			.values({
				criterionId: criterionRowIds.number,
				minValue: 0,
				maxValue: 10,
				minMarks: 10,
				maxMarks: 0,
				reversed: false,
			})
			.execute(),
	).rejects.toThrow("number_criterion_marks_range_check");

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: criterionRowIds.number,
			minValue: 0,
			maxValue: 10,
			minMarks: 5,
			maxMarks: 5,
			reversed: false,
		})
		.execute();

	const persisted = await db
		.selectFrom("numberCriterion")
		.select(["criterionId", "minMarks", "maxMarks"])
		.where("criterionId", "=", criterionRowIds.number)
		.execute();

	const normalizedPersisted = persisted.map((row) => ({
		criterionId: row.criterionId,
		minMarks: Number(row.minMarks),
		maxMarks: Number(row.maxMarks),
	}));

	expect(normalizedPersisted).toEqual([
		{ criterionId: criterionRowIds.number, minMarks: 5, maxMarks: 5 },
	]);
});
