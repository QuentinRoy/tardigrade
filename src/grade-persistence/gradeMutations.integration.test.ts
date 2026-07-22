import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { loadGradeTargetGradesFromDb } from "#grading/grades.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import {
	createMixedCriterionRubricFixtureGrid,
	type MixedCriterionRubricFixture,
} from "#test/mixedCriterionGradeFixture.ts";
import {
	saveCriterionGradeErrors,
	saveCriterionGradesInDb,
} from "./gradeMutations.ts";

// Bare insert of one individual grade target (a student plus its sole-member
// target), returning the target's public id. `createMixedCriterionGradeFixture`'s
// own target helper only returns row ids (it was built for direct-SQL grade
// fixtures); the batch primitive under test is called through its public API,
// so the public target id is what these tests need.
async function addIndividualTarget(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<string> {
	const student = await db
		.insertInto("student")
		.values({
			gridRowId,
			id: buildTestId("student"),
			firstName: "Test",
			lastName: "Student",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const target = await db
		.insertInto("gradeTarget")
		.values({ gridRowId, id: buildTestId("target") })
		.returning(["id", "rowId"])
		.executeTakeFirstOrThrow();

	await db
		.insertInto("gradeTargetStudent")
		.values({ gradeTargetRowId: target.rowId, studentRowId: student.rowId })
		.execute();

	return target.id;
}

async function countCriterionGrades(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<number> {
	const rows = await db
		.selectFrom("criterionGrade")
		.where("gridRowId", "=", gridRowId)
		.select("id")
		.execute();
	return rows.length;
}

test("saveCriterionGradesInDb persists a mixed-kind batch across multiple targets", async () => {
	await using db = await createTestDb();
	const fixture = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Batch Grade Grid",
		rubricId: buildTestId("rubric"),
		checkCriterionId: buildTestId("criterion-check"),
		optionsCriterionId: buildTestId("criterion-options"),
		numberCriterionId: buildTestId("criterion-number"),
	});
	const firstTargetId = await addIndividualTarget(db, fixture.grid.rowId);
	const secondTargetId = await addIndividualTarget(db, fixture.grid.rowId);

	const result = await db.transaction().execute((tx) =>
		saveCriterionGradesInDb(tx, {
			gridId: fixture.grid.id,
			grades: [
				{
					targetId: firstTargetId,
					rubricId: fixture.rubric.id,
					grade: {
						criterionId: fixture.rubric.criteria.checkId,
						kind: "check",
						passed: true,
					},
				},
				{
					targetId: firstTargetId,
					rubricId: fixture.rubric.id,
					grade: {
						criterionId: fixture.rubric.criteria.optionsId,
						kind: "options",
						selectedLabel: "A",
					},
				},
				{
					targetId: secondTargetId,
					rubricId: fixture.rubric.id,
					grade: {
						criterionId: fixture.rubric.criteria.numberId,
						kind: "number",
						value: 7,
					},
				},
			],
		}),
	);

	expect(result).toEqual({ success: true });

	const [firstGrades, secondGrades] = await Promise.all([
		loadGradeTargetGradesFromDb(db, {
			targetId: firstTargetId,
			gridId: fixture.grid.id,
		}),
		loadGradeTargetGradesFromDb(db, {
			targetId: secondTargetId,
			gridId: fixture.grid.id,
		}),
	]);

	const firstByCriterionId = new Map(
		(firstGrades[fixture.rubric.id] ?? []).map((grade) => [
			grade.criterionId,
			grade,
		]),
	);
	expect(firstByCriterionId.get(fixture.rubric.criteria.checkId)).toEqual({
		criterionId: fixture.rubric.criteria.checkId,
		kind: "check",
		passed: true,
	});
	expect(firstByCriterionId.get(fixture.rubric.criteria.optionsId)).toEqual({
		criterionId: fixture.rubric.criteria.optionsId,
		kind: "options",
		selectedLabel: "A",
	});

	const secondByCriterionId = new Map(
		(secondGrades[fixture.rubric.id] ?? []).map((grade) => [
			grade.criterionId,
			grade,
		]),
	);
	expect(secondByCriterionId.get(fixture.rubric.criteria.numberId)).toEqual({
		criterionId: fixture.rubric.criteria.numberId,
		kind: "number",
		value: 7,
	});
});

test("saveCriterionGradesInDb writes nothing when one grade in the batch fails validation", async () => {
	await using db = await createTestDb();
	const fixture = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Batch Grade Partial Failure Grid",
		rubricId: buildTestId("rubric"),
		checkCriterionId: buildTestId("criterion-check"),
		optionsCriterionId: buildTestId("criterion-options"),
		numberCriterionId: buildTestId("criterion-number"),
	});
	const firstTargetId = await addIndividualTarget(db, fixture.grid.rowId);
	const secondTargetId = await addIndividualTarget(db, fixture.grid.rowId);

	const result = await db.transaction().execute((tx) =>
		saveCriterionGradesInDb(tx, {
			gridId: fixture.grid.id,
			grades: [
				{
					targetId: firstTargetId,
					rubricId: fixture.rubric.id,
					grade: {
						criterionId: fixture.rubric.criteria.checkId,
						kind: "check",
						passed: true,
					},
				},
				{
					targetId: secondTargetId,
					rubricId: fixture.rubric.id,
					grade: {
						criterionId: fixture.rubric.criteria.optionsId,
						kind: "options",
						selectedLabel: "Not a real label",
					},
				},
			],
		}),
	);

	expect(result.success).toBe(false);

	expect(await countCriterionGrades(db, fixture.grid.rowId)).toBe(0);
});

test("saveCriterionGradesInDb rejects a batch referencing another grid's rubric without writing anything", async () => {
	await using db = await createTestDb();
	const gridA = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Batch Cross-Grid Grid A",
		rubricId: buildTestId("rubric"),
		checkCriterionId: buildTestId("criterion-check"),
		optionsCriterionId: buildTestId("criterion-options"),
		numberCriterionId: buildTestId("criterion-number"),
	});
	const gridB = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Batch Cross-Grid Grid B",
		rubricId: buildTestId("rubric"),
		checkCriterionId: buildTestId("criterion-check"),
		optionsCriterionId: buildTestId("criterion-options"),
		numberCriterionId: buildTestId("criterion-number"),
	});
	const targetInA = await addIndividualTarget(db, gridA.grid.rowId);

	const result = await db.transaction().execute((tx) =>
		saveCriterionGradesInDb(tx, {
			gridId: gridA.grid.id,
			grades: [
				{
					targetId: targetInA,
					rubricId: gridA.rubric.id,
					grade: {
						criterionId: gridA.rubric.criteria.checkId,
						kind: "check",
						passed: true,
					},
				},
				{
					// Grid B's own rubric, addressed while scoped to grid A.
					targetId: targetInA,
					rubricId: gridB.rubric.id,
					grade: {
						criterionId: gridB.rubric.criteria.checkId,
						kind: "check",
						passed: true,
					},
				},
			],
		}),
	);

	expect(result).toEqual({
		success: false,
		error: saveCriterionGradeErrors.contextMissing,
	});
	expect(await countCriterionGrades(db, gridA.grid.rowId)).toBe(0);
});

test("saveCriterionGradesInDb rejects a batch with two grades for the same target and criterion", async () => {
	await using db = await createTestDb();
	const fixture = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Batch Duplicate Grid",
		rubricId: buildTestId("rubric"),
		checkCriterionId: buildTestId("criterion-check"),
		optionsCriterionId: buildTestId("criterion-options"),
		numberCriterionId: buildTestId("criterion-number"),
	});
	const targetId = await addIndividualTarget(db, fixture.grid.rowId);

	const result = await db.transaction().execute((tx) =>
		saveCriterionGradesInDb(tx, {
			gridId: fixture.grid.id,
			grades: [
				{
					targetId,
					rubricId: fixture.rubric.id,
					grade: {
						criterionId: fixture.rubric.criteria.checkId,
						kind: "check",
						passed: true,
					},
				},
				{
					targetId,
					rubricId: fixture.rubric.id,
					grade: {
						criterionId: fixture.rubric.criteria.checkId,
						kind: "check",
						passed: false,
					},
				},
			],
		}),
	);

	expect(result).toEqual({
		success: false,
		error: saveCriterionGradeErrors.duplicateGrade,
	});
	expect(await countCriterionGrades(db, fixture.grid.rowId)).toBe(0);
});

// Seeds a criterionGrade parent row plus a stale subtype row in a *different*
// kind's table than the criterion's actual kind. Criterion.kind is DB-enforced
// immutable (a `criterion` UPDATE trigger blocks changing it in place), so a
// stale cross-kind subtype row can only arise from a bug or a data-repair path
// bypassing the coordinator — exactly the leftover state
// `clearStaleSubtypeValues` exists to self-heal on the next save.
async function seedStaleCheckGrade(
	db: Kysely<Database>,
	fixture: MixedCriterionRubricFixture,
	targetId: string,
): Promise<number> {
	const [criterion, target] = await Promise.all([
		db
			.selectFrom("criterion")
			.where("id", "=", fixture.rubric.criteria.optionsId)
			.select("rowId")
			.executeTakeFirstOrThrow(),
		db
			.selectFrom("gradeTarget")
			.where("id", "=", targetId)
			.select("rowId")
			.executeTakeFirstOrThrow(),
	]);

	const criterionGrade = await db
		.insertInto("criterionGrade")
		.values({
			gridRowId: fixture.grid.rowId,
			gradeTargetRowId: target.rowId,
			criterionId: criterion.rowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionGrade")
		.values({ criterionGradeId: criterionGrade.id, passed: true })
		.execute();

	return criterion.rowId;
}

test("saveCriterionGradesInDb clears a stale cross-kind subtype value on the next save", async () => {
	await using db = await createTestDb();
	const fixture = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Batch Kind Change Grid",
		rubricId: buildTestId("rubric"),
		checkCriterionId: buildTestId("criterion-check"),
		optionsCriterionId: buildTestId("criterion-options"),
		numberCriterionId: buildTestId("criterion-number"),
	});
	const targetId = await addIndividualTarget(db, fixture.grid.rowId);
	const criterionRowId = await seedStaleCheckGrade(db, fixture, targetId);

	const result = await db
		.transaction()
		.execute((tx) =>
			saveCriterionGradesInDb(tx, {
				gridId: fixture.grid.id,
				grades: [
					{
						targetId,
						rubricId: fixture.rubric.id,
						grade: {
							criterionId: fixture.rubric.criteria.optionsId,
							kind: "options",
							selectedLabel: "A",
						},
					},
				],
			}),
		);
	expect(result).toEqual({ success: true });

	const criterionGrade = await db
		.selectFrom("criterionGrade")
		.where("criterionId", "=", criterionRowId)
		.select("id")
		.executeTakeFirstOrThrow();

	const [checkRows, optionsRows] = await Promise.all([
		db
			.selectFrom("checkCriterionGrade")
			.select("id")
			.where("criterionGradeId", "=", criterionGrade.id)
			.execute(),
		db
			.selectFrom("optionsCriterionGrade")
			.select("selectedLabel")
			.where("criterionGradeId", "=", criterionGrade.id)
			.execute(),
	]);

	expect(checkRows).toHaveLength(0);
	expect(optionsRows).toEqual([{ selectedLabel: "A" }]);
});
