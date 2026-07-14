import type { Kysely } from "kysely";
import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import type { ImportedGradeRow } from "#imports/types.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import { saveGrades } from "./saveGrades.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

async function createGradeFixture(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<{
	rubricId: string;
	studentId: string;
	criterionId: string;
	numberCriterionId: string;
}> {
	const rubricId = buildTestId("rubric");
	const studentId = buildTestId("student");
	const criterionId = buildTestId("criterion");
	const numberCriterionId = buildTestId("criterion-numerical");

	await db
		.insertInto("student")
		.values({
			gridRowId,
			id: studentId,
			lastName: "Import",
			firstName: "Student",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const [targetId] = await nextGradeTargetIds(db, { gridRowId, count: 1 });
	if (targetId == null) throw new Error("Expected a generated id");

	await db
		.insertInto("gradeTarget")
		.values({
			gridRowId,
			id: targetId,
			kind: "individual",
			studentRowId: studentRow.rowId,
		})
		.execute();

	await db
		.insertInto("rubric")
		.values({ gridRowId, id: rubricId, label: "Import rubric", position: 0 })
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select(["id", "rowId"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			gridRowId,
			rubricId: rubric.rowId,
			kind: "check",
			position: 0,
			label: "Correctness",
		})
		.returning(["id", "rowId"])
		.execute();

	const createdCriterion = criterion[0];

	if (createdCriterion == null) {
		throw new Error("Expected criterion row to be created for fixture setup.");
	}

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: createdCriterion.rowId, marks: 2, falseMarks: 0 })
		.execute();

	const numberCriterion = await db
		.insertInto("criterion")
		.values({
			id: numberCriterionId,
			gridRowId,
			rubricId: rubric.rowId,
			kind: "number",
			position: 1,
			label: "Score",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: numberCriterion.rowId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return { rubricId, studentId, criterionId, numberCriterionId };
}

test("saveGrades does not persist valid rows when a later row fails validation", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Atomic Import Grid");
	const gridPublicId = grid.id;
	const fixture = await createGradeFixture(db, grid.rowId);

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "true",
		},
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "not-a-boolean",
		},
	];

	await expect(
		saveGrades({ rows, gridId: gridPublicId }, { db }),
	).rejects.toThrow("Grade import errors:");

	const persistedGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.id")
		.where("gradeTarget.gridRowId", "=", grid.rowId)
		.execute();

	expect(persistedGrades).toHaveLength(0);
});

test("saveGrades rejects unknown columns before writing any grade", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Unknown Column Grid");
	const gridPublicId = grid.id;
	const fixture = await createGradeFixture(db, grid.rowId);

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			unknown_column: "oops",
			[`${fixture.rubricId}:${fixture.criterionId}`]: "true",
		},
	];

	await expect(
		saveGrades({ rows, gridId: gridPublicId }, { db }),
	).rejects.toThrow('Unrecognized column: "unknown_column"');

	const persistedGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.id")
		.where("gradeTarget.gridRowId", "=", grid.rowId)
		.execute();

	expect(persistedGrades).toHaveLength(0);
});

test("saveGrades blocks the import when a row has no matching student or group", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Missing Name Grid");
	const gridPublicId = grid.id;
	const fixture = await createGradeFixture(db, grid.rowId);
	const missingStudentId = buildTestId("missing-student");

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "true",
		},
		{
			kind: "individual",
			name: missingStudentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "true",
		},
	];

	await expect(
		saveGrades({ rows, gridId: gridPublicId }, { db }),
	).rejects.toThrow(
		`No matching individual student or group for "${missingStudentId}"`,
	);

	const persistedGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.id")
		.where("gradeTarget.gridRowId", "=", grid.rowId)
		.execute();

	expect(persistedGrades).toHaveLength(0);
});

test("saveGrades returns imported and overwritten counts", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Overwrite Count Grid");
	const gridPublicId = grid.id;
	const fixture = await createGradeFixture(db, grid.rowId);

	const firstImport: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "true",
		},
	];

	await expect(
		saveGrades({ rows: firstImport, gridId: gridPublicId }, { db }),
	).resolves.toEqual({ gradeCount: 1, overwriteCount: 0 });

	const secondImport: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "false",
			[`${fixture.rubricId}:${fixture.numberCriterionId}`]: "5",
		},
	];

	await expect(
		saveGrades({ rows: secondImport, gridId: gridPublicId }, { db }),
	).resolves.toEqual({ gradeCount: 2, overwriteCount: 1 });
});

test("saveGrades rolls back all writes if a later transactional write fails", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Transactional Rollback Grid");
	const gridPublicId = grid.id;
	const fixture = await createGradeFixture(db, grid.rowId);

	// The first row writes a valid boolean grade; the second row carries a
	// numerical score outside the criterion range. saveGrades parses both rows
	// before the transaction, so the out-of-range score only fails inside
	// saveCriterionGradeInDb — after the first write has already happened in the same
	// transaction. A genuine in-transaction failure, no primitive mock required.
	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "true",
		},
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.numberCriterionId}`]: "999",
		},
	];

	await expect(
		saveGrades({ rows, gridId: gridPublicId }, { db }),
	).rejects.toThrow("Enter a score of at most 10.");

	const persistedGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.id")
		.where("gradeTarget.gridRowId", "=", grid.rowId)
		.execute();

	expect(persistedGrades).toHaveLength(0);
});

test("saveGrades links grades only to the target grid even when the same student id exists in another grid", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Cross-Grid Isolation A");
	await using gridB = await createGrid(db, "Cross-Grid Isolation B");
	const gridBPublicId = gridB.id;

	// The same student external id exists in both grids.
	// Each grid has its own rubric/criterion ids (to avoid saveCriterionGrade
	// ambiguity on shared rubric text ids, which is a separate concern).
	const sharedStudentId = "shared-student-cross-proj";

	async function buildFixtureInGrid(gridRowId: number) {
		const rubricId = buildTestId("rubric");
		const criterionId = buildTestId("criterion");

		await db
			.insertInto("student")
			.values({
				gridRowId,
				id: sharedStudentId,
				lastName: "CrossProj",
				firstName: "Student",
			})
			.execute();

		const studentRow = await db
			.selectFrom("student")
			.select("rowId")
			.where("gridRowId", "=", gridRowId)
			.where("id", "=", sharedStudentId)
			.executeTakeFirstOrThrow();

		const [targetId] = await nextGradeTargetIds(db, { gridRowId, count: 1 });
		if (targetId == null) throw new Error("Expected a generated id");

		await db
			.insertInto("gradeTarget")
			.values({
				gridRowId,
				id: targetId,
				kind: "individual",
				studentRowId: studentRow.rowId,
			})
			.execute();

		await db
			.insertInto("rubric")
			.values({ gridRowId, id: rubricId, label: "Q", position: 0 })
			.execute();

		const rubric = await db
			.selectFrom("rubric")
			.select("rowId")
			.where("gridRowId", "=", gridRowId)
			.where("id", "=", rubricId)
			.executeTakeFirstOrThrow();

		const criterionRows = await db
			.insertInto("criterion")
			.values({
				id: criterionId,
				gridRowId,
				rubricId: rubric.rowId,
				kind: "check",
				position: 0,
				label: "Correct",
			})
			.returning("rowId")
			.execute();

		const criterion = criterionRows[0];
		if (criterion == null) throw new Error("Expected criterion row");

		await db
			.insertInto("checkCriterion")
			.values({ criterionId: criterion.rowId, marks: 1, falseMarks: 0 })
			.execute();

		return { rubricId, criterionId };
	}

	// Build fixtures; only capture grid B's ids for the import rows
	await buildFixtureInGrid(gridA.rowId);
	const { rubricId: rubricBId, criterionId: criterionBId } =
		await buildFixtureInGrid(gridB.rowId);

	// Import grades targeting grid B only using grid B's criterion column
	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: sharedStudentId,
			[`${rubricBId}:${criterionBId}`]: "true",
		},
	];

	await saveGrades({ rows, gridId: gridBPublicId }, { db });

	// Grid A must have zero grades
	const gridAGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.id")
		.where("gradeTarget.gridRowId", "=", gridA.rowId)
		.execute();

	expect(gridAGrades).toHaveLength(0);

	// Grid B must have exactly one grade
	const gridBGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.id")
		.where("gradeTarget.gridRowId", "=", gridB.rowId)
		.execute();

	expect(gridBGrades).toHaveLength(1);
});

test("saveGrades invalidates the grade tags after the import commits", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Import Invalidation Grid");
	const fixture = await createGradeFixture(db, grid.rowId);

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "true",
		},
	];

	await saveGrades({ rows, gridId: grid.id }, { db });

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["grades", "max"],
		["grades:all", "max"],
	]);
});

test("saveGrades does not invalidate when the import fails", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Import Failure Grid");
	const fixture = await createGradeFixture(db, grid.rowId);

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: fixture.studentId,
			[`${fixture.rubricId}:${fixture.criterionId}`]: "not-a-boolean",
		},
	];

	await expect(saveGrades({ rows, gridId: grid.id }, { db })).rejects.toThrow(
		"Grade import errors:",
	);

	expect(revalidateTag).not.toHaveBeenCalled();
});
