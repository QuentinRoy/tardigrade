import type { Kysely } from "kysely";
import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import { loadGradeTargetGradesFromDb } from "#grading/grades.ts";
import type { ImportedGradeRow } from "#imports/types.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import { createMixedCriterionRubricFixtureGrid } from "#test/mixedCriterionGradeFixture.ts";
import { withQueryCounter } from "#test/queryCounting.ts";
import { GRADE_IMPORT_WRITE_CHUNK_SIZE, saveGrades } from "./saveGrades.ts";

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
	const numberCriterionId = buildTestId("criterion-number");

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

	const target = await db
		.insertInto("gradeTarget")
		.values({ gridRowId, id: targetId })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("gradeTargetStudent")
		.values({ gradeTargetRowId: target.rowId, studentRowId: studentRow.rowId })
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
			rubricRowId: rubric.rowId,
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
		.values({ criterionRowId: createdCriterion.rowId, marks: 2, falseMarks: 0 })
		.execute();

	const numberCriterion = await db
		.insertInto("criterion")
		.values({
			id: numberCriterionId,
			gridRowId,
			rubricRowId: rubric.rowId,
			kind: "number",
			position: 1,
			label: "Value",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionRowId: numberCriterion.rowId,
			minValue: 0,
			maxValue: 10,
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
		.select("criterionGrade.criterionRowId")
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
		.select("criterionGrade.criterionRowId")
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
		.select("criterionGrade.criterionRowId")
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

test("saveGrades reports an out-of-range Number cell before writing any grade", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Transactional Rollback Grid");
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
			[`${fixture.rubricId}:${fixture.numberCriterionId}`]: "999",
		},
	];

	await expect(
		saveGrades({ rows, gridId: gridPublicId }, { db }),
	).rejects.toThrow(
		`Row 3 (${fixture.studentId}): Enter a value of at most 10. in column "${fixture.rubricId}:${fixture.numberCriterionId}"`,
	);

	const persistedGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.criterionRowId")
		.where("gradeTarget.gridRowId", "=", grid.rowId)
		.execute();

	expect(persistedGrades).toHaveLength(0);
});

test("saveGrades reports both duplicate Grade Cell locations before writing", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Duplicate Grade Cell Grid");
	const fixture = await createGradeFixture(db, grid.rowId);
	const column = `${fixture.rubricId}:${fixture.criterionId}`;
	const rows: ImportedGradeRow[] = [
		{ kind: "individual", name: fixture.studentId, [column]: "true" },
		{ kind: "individual", name: fixture.studentId, [column]: "false" },
	];

	await expect(saveGrades({ rows, gridId: grid.id }, { db })).rejects.toThrow(
		`Rows 2, column "${column}" and 3, column "${column}" both import a grade for the same student or group and criterion. Remove one of these values`,
	);

	const persistedGrades = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.select("criterionGrade.criterionRowId")
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

		const target = await db
			.insertInto("gradeTarget")
			.values({ gridRowId, id: targetId })
			.returning("rowId")
			.executeTakeFirstOrThrow();

		await db
			.insertInto("gradeTargetStudent")
			.values({
				gradeTargetRowId: target.rowId,
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
				rubricRowId: rubric.rowId,
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
			.values({ criterionRowId: criterion.rowId, marks: 1, falseMarks: 0 })
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
		.select("criterionGrade.criterionRowId")
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
		.select("criterionGrade.criterionRowId")
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
		[`grids:${grid.id}:grades`, "max"],
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

// A single Check criterion, so every scenario below writes exactly one kind:
// the regression check isolates chunk-count growth from kind-count growth.
async function createCheckCriterionFixture(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<{ rubricId: string; criterionId: string }> {
	const rubricId = buildTestId("rubric");
	const criterionId = buildTestId("criterion");

	const rubric = await db
		.insertInto("rubric")
		.values({ gridRowId, id: rubricId, label: "Chunking rubric", position: 0 })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			gridRowId,
			rubricRowId: rubric.rowId,
			kind: "check",
			position: 0,
			label: "Correctness",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterion")
		.values({ criterionRowId: criterion.rowId, marks: 1, falseMarks: 0 })
		.execute();

	return { rubricId, criterionId };
}

// Bulk-creates `count` fresh students, each its own individual grade target,
// in a bounded number of statements regardless of `count`.
async function createIndividualTargets(
	db: Kysely<Database>,
	{ gridRowId, count }: { gridRowId: number; count: number },
): Promise<{ studentId: string; targetId: string }[]> {
	const studentIds = Array.from({ length: count }, () =>
		buildTestId("student"),
	);

	await db
		.insertInto("student")
		.values(
			studentIds.map((id) => ({
				gridRowId,
				id,
				firstName: "Test",
				lastName: "Student",
			})),
		)
		.execute();

	const studentRows = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "in", studentIds)
		.execute();

	const targetIds = await nextGradeTargetIds(db, {
		gridRowId,
		count: studentRows.length,
	});

	const targetsToInsert = studentRows.map((row, index) => {
		const targetId = targetIds[index];
		if (targetId == null) {
			throw new Error("Expected a reserved grade target id.");
		}
		return { studentId: row.id, targetId, studentRowId: row.rowId };
	});

	const targetRows = await db
		.insertInto("gradeTarget")
		.values(
			targetsToInsert.map(({ targetId }) => ({ gridRowId, id: targetId })),
		)
		.returning(["rowId", "id"])
		.execute();

	const targetRowIdByPublicId = new Map(
		targetRows.map((row) => [row.id, row.rowId]),
	);

	await db
		.insertInto("gradeTargetStudent")
		.values(
			targetsToInsert.map((target) => {
				const gradeTargetRowId = targetRowIdByPublicId.get(target.targetId);
				if (gradeTargetRowId == null) {
					throw new Error("Expected an inserted grade target row.");
				}
				return { gradeTargetRowId, studentRowId: target.studentRowId };
			}),
		)
		.execute();

	return targetsToInsert.map(({ studentId, targetId }) => ({
		studentId,
		targetId,
	}));
}

test("saveGrades keeps database statement growth bounded to write chunks, not to Grade count", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Chunked Import Grid");
	const { rubricId, criterionId } = await createCheckCriterionFixture(
		db,
		grid.rowId,
	);
	const column = `${rubricId}:${criterionId}`;

	// Each call targets its own fresh students/targets, so scenarios never
	// contend over the same Grade Target + Criterion pair.
	async function countQueriesForImport(params: {
		rowCount: number;
		blank: boolean;
	}): Promise<number> {
		const targets = await createIndividualTargets(db, {
			gridRowId: grid.rowId,
			count: params.rowCount,
		});
		const rows: ImportedGradeRow[] = targets.map(({ studentId }) => ({
			kind: "individual",
			name: studentId,
			[column]: params.blank ? "" : "true",
		}));
		const { db: countingDb, counter } = withQueryCounter(db);

		await saveGrades({ rows, gridId: grid.id }, { db: countingDb });

		return counter.count;
	}

	// A blank cell writes nothing, isolating the fixed context-loading query
	// count from any write-chunk query.
	const zeroWriteCount = await countQueriesForImport({
		rowCount: 1,
		blank: true,
	});
	const smallChunkCount = await countQueriesForImport({
		rowCount: 3,
		blank: false,
	});
	const fullChunkCount = await countQueriesForImport({
		rowCount: GRADE_IMPORT_WRITE_CHUNK_SIZE,
		blank: false,
	});
	const overChunkCount = await countQueriesForImport({
		rowCount: GRADE_IMPORT_WRITE_CHUNK_SIZE + 1,
		blank: false,
	});

	// Growing the Grade count within one chunk (3 up to a full chunk) issues
	// the exact same number of statements: the executor resolves and writes
	// each chunk with set-based queries, not one resolution/write sequence per
	// Grade.
	expect(smallChunkCount).toBe(fullChunkCount);

	// Crossing a chunk boundary adds exactly one more chunk's worth of
	// statements — the same fixed amount every additional chunk costs — proving
	// growth tracks chunk count, not Grade count.
	expect(overChunkCount - fullChunkCount).toBe(fullChunkCount - zeroWriteCount);
});

test("saveGrades persists a mixed Check, Options, and Number import, overwriting an existing grade and skipping a blank cell", async () => {
	await using db = await createTestDb();
	const fixture = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Mixed Kind Import Grid",
		rubricId: buildTestId("rubric"),
		checkCriterionId: buildTestId("criterion-check"),
		optionsCriterionId: buildTestId("criterion-options"),
		numberCriterionId: buildTestId("criterion-number"),
	});
	const [firstTarget, secondTarget] = await createIndividualTargets(db, {
		gridRowId: fixture.grid.rowId,
		count: 2,
	});
	if (firstTarget == null || secondTarget == null) {
		throw new Error("Expected two created grade targets.");
	}

	const checkColumn = `${fixture.rubric.id}:${fixture.rubric.criteria.checkId}`;
	const optionsColumn = `${fixture.rubric.id}:${fixture.rubric.criteria.optionsId}`;
	const numberColumn = `${fixture.rubric.id}:${fixture.rubric.criteria.numberId}`;

	// Seed an existing Check grade for the first target, so the mixed import
	// below overwrites it.
	await saveGrades(
		{
			rows: [
				{
					kind: "individual",
					name: firstTarget.studentId,
					[checkColumn]: "false",
				},
			],
			gridId: fixture.grid.id,
		},
		{ db },
	);

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: firstTarget.studentId,
			[checkColumn]: "true",
			[optionsColumn]: "A",
			[numberColumn]: "7",
		},
		{
			// A blank Number cell alongside filled Check/Options cells: the blank
			// cell is skipped, the others are still written.
			kind: "individual",
			name: secondTarget.studentId,
			[checkColumn]: "true",
			[optionsColumn]: "B",
			[numberColumn]: "",
		},
	];

	await expect(
		saveGrades({ rows, gridId: fixture.grid.id }, { db }),
	).resolves.toEqual({ gradeCount: 5, overwriteCount: 1 });

	const [firstGrades, secondGrades] = await Promise.all([
		loadGradeTargetGradesFromDb(db, {
			targetId: firstTarget.targetId,
			gridId: fixture.grid.id,
		}),
		loadGradeTargetGradesFromDb(db, {
			targetId: secondTarget.targetId,
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
	expect(firstByCriterionId.get(fixture.rubric.criteria.numberId)).toEqual({
		criterionId: fixture.rubric.criteria.numberId,
		kind: "number",
		value: 7,
	});

	const secondByCriterionId = new Map(
		(secondGrades[fixture.rubric.id] ?? []).map((grade) => [
			grade.criterionId,
			grade,
		]),
	);
	expect(secondByCriterionId.get(fixture.rubric.criteria.checkId)).toEqual({
		criterionId: fixture.rubric.criteria.checkId,
		kind: "check",
		passed: true,
	});
	expect(secondByCriterionId.get(fixture.rubric.criteria.optionsId)).toEqual({
		criterionId: fixture.rubric.criteria.optionsId,
		kind: "options",
		selectedLabel: "B",
	});
	expect(
		secondByCriterionId.get(fixture.rubric.criteria.numberId),
	).toBeUndefined();
});
