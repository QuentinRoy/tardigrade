import type { Kysely } from "kysely";
import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import {
	buildGradedCriterionCountsByTarget,
	criterionGradesCountCacheTags,
	gradeCompletionRowsCacheTags,
	gradedCriterionCountsByTargetCacheTags,
	loadGradeCompletionByTarget,
	loadGradeCompletionByTargetFromDb,
	loadGradeCompletionSummary,
	loadGradeCompletionSummaryFromDb,
	loadGradedCriterionCounts,
	loadGradedCriterionCountsByTarget,
	loadGradedCriterionCountsByTargetFromDb,
} from "./loadGradeCompletion.ts";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

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
			lastName: "Completion",
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
		.values({
			gridRowId: gridRowId,
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
	gridRowId: number,
	rubricId: string,
	{ criterionId }: { criterionId?: string } = {},
): Promise<{ rubricRowId: number; criterionRowId: number | null }> {
	await db
		.insertInto("rubric")
		.values({
			gridRowId: gridRowId,
			id: rubricId,
			label: "Shared Q",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select(["rowId"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	if (criterionId == null) {
		return { rubricRowId: rubric.rowId, criterionRowId: null };
	}

	const criterionRows = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			gridRowId: gridRowId,
			rubricId: rubric.rowId,
			kind: "check",
			position: 0,
			label: "Correct",
		})
		.returning(["rowId"])
		.execute();

	const criterion = criterionRows[0];
	if (criterion == null) throw new Error("Expected criterion row");

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: criterion.rowId, marks: 1, falseMarks: 0 })
		.execute();

	return { rubricRowId: rubric.rowId, criterionRowId: criterion.rowId };
}

async function addGrade(
	db: Kysely<Database>,
	{
		gradeTargetRowId,
		criterionRowId,
	}: { gradeTargetRowId: number; criterionRowId: number },
): Promise<void> {
	const criterionGrade = await db
		.insertInto("criterionGrade")
		.values({ gradeTargetRowId, criterionId: criterionRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionGrade")
		.values({ criterionGradeId: criterionGrade.id, passed: true })
		.execute();
}

test("loadGradedCriterionCountsByTargetFromDb counts only grades within the requested grid when rubric ids collide across grids", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Completion Isolation A");
	await using gridB = await createGrid(db, "Completion Isolation B");

	const sharedRubricId = "shared-q-completion-iso";
	const sharedCriterionId = "shared-criterion-completion-iso";

	const targetA = await createGradeTarget(db, gridA.rowId);
	const targetB = await createGradeTarget(db, gridB.rowId);
	await createRubric(db, gridA.rowId, sharedRubricId, {
		criterionId: sharedCriterionId,
	});
	const { criterionRowId: criterionBRowId } = await createRubric(
		db,
		gridB.rowId,
		sharedRubricId,
		{ criterionId: sharedCriterionId },
	);

	// Add grade only for grid B
	if (criterionBRowId == null) throw new Error("Expected criterion row");
	await addGrade(db, {
		gradeTargetRowId: targetB.rowId,
		criterionRowId: criterionBRowId,
	});

	const completionA = await loadGradedCriterionCountsByTargetFromDb(db, {
		rubricId: sharedRubricId,
		gridId: gridA.id,
	});
	const completionB = await loadGradedCriterionCountsByTargetFromDb(db, {
		rubricId: sharedRubricId,
		gridId: gridB.id,
	});

	// Grid A target has no grade — should show 0 completed
	expect(completionA[targetA.id]).toEqual({ completed: 0, total: 1 });

	// Grid B target has a complete grade — should show 1 completed
	expect(completionB[targetB.id]).toEqual({ completed: 1, total: 1 });

	// Each grid's result contains only its own single target — ids are
	// per-grid ordinals, so targetA.id and targetB.id legitimately collide
	// (both "t-1"); isolation means each map has exactly one entry, not that
	// the id values differ.
	expect(Object.keys(completionA)).toEqual([targetA.id]);
	expect(Object.keys(completionB)).toEqual([targetB.id]);
});

test("loadGradeCompletionByTargetFromDb counts only rubrics and grades within the requested grid when rubric ids collide across grids", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Overview Completion Isolation A");
	await using gridB = await createGrid(db, "Overview Completion Isolation B");

	const sharedRubricId = "shared-q-overview-iso";
	const sharedCriterionId = "shared-criterion-overview-iso";

	const targetA = await createGradeTarget(db, gridA.rowId);
	const targetB = await createGradeTarget(db, gridB.rowId);
	await createRubric(db, gridA.rowId, sharedRubricId, {
		criterionId: sharedCriterionId,
	});
	const { criterionRowId: criterionBRowId } = await createRubric(
		db,
		gridB.rowId,
		sharedRubricId,
		{ criterionId: sharedCriterionId },
	);

	// Add grade only for grid B
	if (criterionBRowId == null) throw new Error("Expected criterion row");
	await addGrade(db, {
		gradeTargetRowId: targetB.rowId,
		criterionRowId: criterionBRowId,
	});

	const overviewA = await loadGradeCompletionByTargetFromDb(db, {
		gridId: gridA.id,
	});
	const overviewB = await loadGradeCompletionByTargetFromDb(db, {
		gridId: gridB.id,
	});

	// Grid A has 1 rubric, 0 completed for its target
	expect(overviewA[targetA.id]).toEqual({ completed: 0, total: 1 });

	// Grid B has 1 rubric, 1 completed for its target
	expect(overviewB[targetB.id]).toEqual({ completed: 1, total: 1 });

	// Each grid's result contains only its own single target — ids are
	// per-grid ordinals, so targetA.id and targetB.id legitimately collide
	// (both "t-1"); isolation means each map has exactly one entry, not that
	// the id values differ.
	expect(Object.keys(overviewA)).toEqual([targetA.id]);
	expect(Object.keys(overviewB)).toEqual([targetB.id]);
});

test("loadGradedCriterionCountsByTarget wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Rubric Completion Wrapper");
	const sharedRubricId = buildTestId("rubric");
	const target = await createGradeTarget(db, grid.rowId);
	await createRubric(db, grid.rowId, sharedRubricId, {
		criterionId: buildTestId("criterion"),
	});

	const completion = await loadGradedCriterionCountsByTarget(
		{ rubricId: sharedRubricId, gridId: grid.id },
		{ db },
	);

	expect(completion[target.id]).toEqual({ completed: 0, total: 1 });

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(
		gradedCriterionCountsByTargetCacheTags({
			gridId: grid.id,
			rubricId: sharedRubricId,
		}),
	);
});

test("loadGradedCriterionCounts plus buildGradedCriterionCountsByTarget matches the combined primitive, given the same target ids", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Rubric Completion Split");
	const rubricId = buildTestId("rubric");
	const target = await createGradeTarget(db, grid.rowId);
	await createRubric(db, grid.rowId, rubricId, {
		criterionId: buildTestId("criterion"),
	});

	const combined = await loadGradedCriterionCountsByTargetFromDb(db, {
		rubricId,
		gridId: grid.id,
	});

	// Reuses an already-loaded target id instead of letting the counts
	// primitive query grade targets itself (Finding 7).
	const counts = await loadGradedCriterionCounts(
		{ rubricId, gridId: grid.id },
		{ db },
	);
	const split = buildGradedCriterionCountsByTarget([target.id], counts);

	expect(split).toEqual(combined);
});

test("loadGradeCompletionByTarget is a plain deriver that shares loadGradeCompletionRows' cache entry", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Overview Completion Wrapper");
	const target = await createGradeTarget(db, grid.rowId);
	await createRubric(db, grid.rowId, buildTestId("rubric"), {
		criterionId: buildTestId("criterion"),
	});

	const overview = await loadGradeCompletionByTarget(
		{ gridId: grid.id },
		{ db },
	);

	expect(overview[target.id]).toEqual({ completed: 0, total: 1 });

	// No own cache scope (ADR 0008 rule 5): only `loadGradeCompletionRows`
	// registers tags.
	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(
		gradeCompletionRowsCacheTags({ gridId: grid.id }),
	);
});

test("a zero-criterion rubric counts as complete per target and consistently with the summary", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Zero Criterion Rubric");

	const target = await createGradeTarget(db, grid.rowId);
	await createRubric(db, grid.rowId, buildTestId("rubric"));

	const byTarget = await loadGradeCompletionByTargetFromDb(db, {
		gridId: grid.id,
	});
	const summary = await loadGradeCompletionSummaryFromDb(db, {
		gridId: grid.id,
	});

	expect(byTarget[target.id]).toEqual({ completed: 1, total: 1 });
	expect(summary.rubrics).toEqual({ completed: 1, total: 1 });
	expect(summary.gradeTargets).toEqual({ completed: 1, total: 1 });
});

test("loadGradeCompletionSummaryFromDb characterizes mixed completion across grade targets and rubrics", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Mixed Completion Summary");

	const targetDone = await createGradeTarget(db, grid.rowId);
	await createGradeTarget(db, grid.rowId);

	const { criterionRowId } = await createRubric(
		db,
		grid.rowId,
		buildTestId("rubric"),
		{ criterionId: buildTestId("criterion") },
	);
	if (criterionRowId == null) throw new Error("Expected criterion row");

	await addGrade(db, { gradeTargetRowId: targetDone.rowId, criterionRowId });

	const summary = await loadGradeCompletionSummaryFromDb(db, {
		gridId: grid.id,
	});

	expect(summary).toEqual({
		gradeTargets: { completed: 1, total: 2 },
		rubrics: { completed: 0, total: 1 },
		criteria: { completed: 1, total: 2 },
	});
});

test("loadGradeCompletionSummaryFromDb returns vacuous aggregates for an empty grid", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Empty Grid Summary");

	const summary = await loadGradeCompletionSummaryFromDb(db, {
		gridId: grid.id,
	});

	expect(summary).toEqual({
		gradeTargets: { completed: 0, total: 0 },
		rubrics: { completed: 0, total: 0 },
		criteria: { completed: 0, total: 0 },
	});
});

test("loadGradeCompletionSummary is a plain deriver that shares loadGradeCompletionRows' cache entry", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Summary Wrapper");
	await createGradeTarget(db, grid.rowId);
	await createRubric(db, grid.rowId, buildTestId("rubric"), {
		criterionId: buildTestId("criterion"),
	});

	const summary = await loadGradeCompletionSummary({ gridId: grid.id }, { db });

	expect(summary).toEqual({
		gradeTargets: { completed: 0, total: 1 },
		rubrics: { completed: 0, total: 1 },
		criteria: { completed: 0, total: 1 },
	});

	// No own cache scope (ADR 0008 rule 5): registers the tags of the two cached
	// sources it composes, `loadGradeCompletionRows` and
	// `loadCriterionGradesCount`.
	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual([
		...gradeCompletionRowsCacheTags({ gridId: grid.id }),
		...criterionGradesCountCacheTags({ gridId: grid.id }),
	]);
});
