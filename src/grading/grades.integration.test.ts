import { cacheTag } from "next/cache";
import { expect, test, vi } from "vitest";
import { saveCriterionGradeInDb } from "#grade-persistence/gradeMutations.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createGradeFixture } from "#test/grades.ts";
import { createProject } from "#test/projects.ts";
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
	await using project = await createProject(db, "Grade Read Empty Project");
	const fixture = await createGradeFixture(db, project.id);

	const result = await loadRubricGradeFromDb(db, {
		targetId: fixture.gradeTargetId,
		projectId: fixture.projectId,
		rubricId: fixture.rubricId,
	});

	expect(result).toEqual([]);
});

test("loadRubricGradeFromDb returns the stored criterion values for a grade target/rubric", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Grade Read Project");
	const fixture = await createGradeFixture(db, project.id);

	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});
	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.ordinal,
			kind: "options",
			selectedLabel: "B",
		},
	});
	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.numerical,
			kind: "number",
			score: 7.5,
		},
	});

	const loaded = await loadRubricGradeFromDb(db, {
		targetId: fixture.gradeTargetId,
		projectId: fixture.projectId,
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
		score: 7.5,
	});
});

// Next caching is inert under vitest, so the read wrapper runs directly against the
// injected handle. Assert it delegates to its primitive (returns the test db's rows)
// and declares "grades:all" alongside its granular tag: bulk imports only bust
// the coarse tag, so without this declaration the per-rubric grading view would
// serve stale data after an grade import.
test("loadRubricGrade wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Grade Cache Tag Project");
	const fixture = await createGradeFixture(db, project.id);

	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
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
			projectId: fixture.projectId,
			rubricId: fixture.rubricId,
		},
		{ db },
	);

	expect(loaded).toEqual([
		{ criterionId: fixture.criterionIds.boolean, kind: "check", passed: true },
	]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toContain("grades:all");
	expect(declaredTags).toContain(
		`grades:${fixture.gradeTargetId}:${fixture.rubricId}`,
	);
});

test("loadGradeTargetGradesFromDb groups a grade target's criterion values by rubric", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Grade Grade Target Read Project",
	);
	const fixture = await createGradeFixture(db, project.id);
	// Second rubric on the same target's project, so the grouping across
	// rubrics is observable.
	const secondRubric = await createBooleanRubricFixture(db, project.rowId, 1);

	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});
	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.numerical,
			kind: "number",
			score: 7.5,
		},
	});
	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
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
		projectId: fixture.projectId,
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
				score: 7.5,
			},
		]),
	);
	expect(byRubricId[secondRubric.rubricId]).toEqual([
		{ criterionId: secondRubric.criterionId, kind: "check", passed: false },
	]);
});

// Mirrors the loadRubricGrade wrapper test: the whole-target read must
// declare the target-scoped tag (busted by individual saves) and
// "grades:all" (busted by bulk imports) or the overview would serve stale data.
test("loadGradeTargetGrades wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Grade Grade Target Cache Tag Project",
	);
	const fixture = await createGradeFixture(db, project.id);

	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	const loaded = await loadGradeTargetGrades(
		{ targetId: fixture.gradeTargetId, projectId: fixture.projectId },
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
	expect(declaredTags).toContain("grades:all");
	expect(declaredTags).toContain(`grades:${fixture.gradeTargetId}`);
});

// The reads scope by Project ID; a mismatched Project ID must not leak another
// project's data.
test("grade reads return nothing when the Project ID does not match the grade target", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Grade Scope Project A");
	await using projectB = await createProject(db, "Grade Scope Project B");
	const fixture = await createGradeFixture(db, projectA.id);

	await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
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
		projectId: projectB.id,
		rubricId: fixture.rubricId,
	});
	expect(rubricGrade).toEqual([]);

	const gradeTargetGrades = await loadGradeTargetGradesFromDb(db, {
		targetId: fixture.gradeTargetId,
		projectId: projectB.id,
	});
	expect(gradeTargetGrades).toEqual({});
});
