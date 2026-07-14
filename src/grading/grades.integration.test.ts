import { cacheTag } from "next/cache";
import { expect, test, vi } from "vitest";
import { saveCriterionGradeInDb } from "#grade-persistence/gradeMutations.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createGradeFixture } from "#test/grades.ts";
import { createGrid } from "#test/grids.ts";
import { createBooleanRubricFixture } from "#test/rubrics.ts";
import {
	loadGradeTargetGrades,
	loadGradeTargetGradesFromDb,
	loadRubricGrade,
	loadRubricGradeFromDb,
} from "./grades.ts";

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
	updateTag: vi.fn(),
}));

test("loadRubricGradeFromDb returns an empty list when no grade exists", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Grade Read Empty Grid");
	const fixture = await createGradeFixture(db, grid.id);

	const result = await loadRubricGradeFromDb(db, {
		targetId: fixture.gradeTargetId,
		gridId: fixture.gridId,
		rubricId: fixture.rubricId,
	});

	expect(result).toEqual([]);
});

test("loadRubricGradeFromDb returns the stored criterion values for a grade target/rubric", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Grade Read Grid");
	const fixture = await createGradeFixture(db, grid.id);

	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});
	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.ordinal,
			kind: "options",
			selectedLabel: "B",
		},
	});
	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.numerical,
			kind: "number",
			value: 7.5,
		},
	});

	const loaded = await loadRubricGradeFromDb(db, {
		targetId: fixture.gradeTargetId,
		gridId: fixture.gridId,
		rubricId: fixture.rubricId,
	});

	const byCriterionId = new Map(
		loaded.map((value) => [value.criterionId, value]),
	);

	expect(byCriterionId.get(fixture.criterionIds.boolean)).toEqual({
		criterionId: fixture.criterionIds.boolean,
		kind: "check",
		passed: true,
	});
	expect(byCriterionId.get(fixture.criterionIds.ordinal)).toEqual({
		criterionId: fixture.criterionIds.ordinal,
		kind: "options",
		selectedLabel: "B",
	});
	expect(byCriterionId.get(fixture.criterionIds.numerical)).toEqual({
		criterionId: fixture.criterionIds.numerical,
		kind: "number",
		value: 7.5,
	});
});

// Next caching is inert under vitest, so the read wrapper runs directly against the
// injected handle. Assert it delegates to its primitive (returns the test db's rows)
// and declares `grids:{gridId}:grades` alongside its granular tag: bulk imports bust
// the coarse tag, so without this declaration the per-rubric grading view would
// serve stale data after a grade import.
test("loadRubricGrade wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Grade Cache Tag Grid");
	const fixture = await createGradeFixture(db, grid.id);

	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	const loaded = await loadRubricGrade(
		{
			targetId: fixture.gradeTargetId,
			gridId: fixture.gridId,
			rubricId: fixture.rubricId,
		},
		{ db },
	);

	expect(loaded).toEqual([
		{ criterionId: fixture.criterionIds.boolean, kind: "check", passed: true },
	]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toContain(`grids:${fixture.gridId}:grades`);
	expect(declaredTags).toContain(
		`grids:${fixture.gridId}:grades:target:${fixture.gradeTargetId}:rubric:${fixture.rubricId}`,
	);
});

test("loadGradeTargetGradesFromDb groups a grade target's criterion values by rubric", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Grade Grade Target Read Grid");
	const fixture = await createGradeFixture(db, grid.id);
	// Second rubric on the same target's grid, so the grouping across
	// rubrics is observable.
	const secondRubric = await createBooleanRubricFixture(db, grid.rowId, 1);

	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});
	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.numerical,
			kind: "number",
			value: 7.5,
		},
	});
	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: secondRubric.rubricId,
		grade: {
			criterionId: secondRubric.criterionId,
			kind: "check",
			passed: false,
		},
	});

	const byRubricId = await loadGradeTargetGradesFromDb(db, {
		targetId: fixture.gradeTargetId,
		gridId: fixture.gridId,
	});

	expect(Object.keys(byRubricId).toSorted()).toEqual(
		[fixture.rubricId, secondRubric.rubricId].toSorted(),
	);
	expect(byRubricId[fixture.rubricId]).toEqual(
		expect.arrayContaining([
			{
				criterionId: fixture.criterionIds.boolean,
				kind: "check",
				passed: true,
			},
			{
				criterionId: fixture.criterionIds.numerical,
				kind: "number",
				value: 7.5,
			},
		]),
	);
	expect(byRubricId[secondRubric.rubricId]).toEqual([
		{ criterionId: secondRubric.criterionId, kind: "check", passed: false },
	]);
});

// Mirrors the loadRubricGrade wrapper test: the whole-target read must
// declare the target-scoped tag (busted by individual saves) and
// `grids:{gridId}:grades` (busted by bulk imports) or the overview would serve stale data.
test("loadGradeTargetGrades wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Grade Grade Target Cache Tag Grid");
	const fixture = await createGradeFixture(db, grid.id);

	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	const loaded = await loadGradeTargetGrades(
		{ targetId: fixture.gradeTargetId, gridId: fixture.gridId },
		{ db },
	);

	expect(loaded).toEqual({
		[fixture.rubricId]: [
			{
				criterionId: fixture.criterionIds.boolean,
				kind: "check",
				passed: true,
			},
		],
	});

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toContain(`grids:${fixture.gridId}:grades`);
	expect(declaredTags).toContain(
		`grids:${fixture.gridId}:grades:target:${fixture.gradeTargetId}`,
	);
});

// The reads scope by Grid ID; a mismatched Grid ID must not leak another
// grid's data.
test("grade reads return nothing when the Grid ID does not match the grade target", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Grade Scope Grid A");
	await using gridB = await createGrid(db, "Grade Scope Grid B");
	const fixture = await createGradeFixture(db, gridA.id);

	await saveCriterionGradeInDb(db, {
		gridId: fixture.gridId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	const rubricGrade = await loadRubricGradeFromDb(db, {
		targetId: fixture.gradeTargetId,
		gridId: gridB.id,
		rubricId: fixture.rubricId,
	});
	expect(rubricGrade).toEqual([]);

	const gradeTargetGrades = await loadGradeTargetGradesFromDb(db, {
		targetId: fixture.gradeTargetId,
		gridId: gridB.id,
	});
	expect(gradeTargetGrades).toEqual({});
});
