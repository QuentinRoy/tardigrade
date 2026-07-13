import type { Kysely } from "kysely";
import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { nextGradeTargetIds } from "#grade-targets/gradeTargets.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	assessedCriterionCountsByTargetCacheTags,
	assessmentCompletionRowsCacheTags,
	buildAssessedCriterionCountsByTarget,
	criterionAssessmentsCountCacheTags,
	loadAssessedCriterionCounts,
	loadAssessedCriterionCountsByTarget,
	loadAssessedCriterionCountsByTargetFromDb,
	loadAssessmentCompletionByTarget,
	loadAssessmentCompletionByTargetFromDb,
	loadAssessmentCompletionSummary,
	loadAssessmentCompletionSummaryFromDb,
} from "./loadAssessmentCompletion.ts";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

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
			lastName: "Progress",
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
	{ criterionId }: { criterionId?: string } = {},
): Promise<{ rubricRowId: number; criterionRowId: number | null }> {
	await db
		.insertInto("rubric")
		.values({
			projectId: projectRowId,
			id: rubricId,
			label: "Shared Q",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select(["rowId"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	if (criterionId == null) {
		return { rubricRowId: rubric.rowId, criterionRowId: null };
	}

	const criterionRows = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			projectId: projectRowId,
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

async function addAssessment(
	db: Kysely<Database>,
	{
		projectRowId,
		gradeTargetRowId,
		rubricRowId,
		criterionRowId,
	}: {
		projectRowId: number;
		gradeTargetRowId: number;
		rubricRowId: number;
		criterionRowId?: number;
	},
): Promise<void> {
	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId: projectRowId,
			gradeTargetRowId,
			rubricId: rubricRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	if (criterionRowId == null) {
		return;
	}

	await db
		.insertInto("criterionAssessment")
		.values({
			assessmentId: assessment.id,
			criterionId: criterionRowId,
			kind: "check",
		})
		.execute();

	const criterionAssessment = await db
		.selectFrom("criterionAssessment")
		.select("id")
		.where("assessmentId", "=", assessment.id)
		.where("criterionId", "=", criterionRowId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionAssessment")
		.values({ criterionAssessmentId: criterionAssessment.id, passed: true })
		.execute();
}

test("loadAssessedCriterionCountsByTargetFromDb counts only assessments within the requested project when rubric ids collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Progress Isolation A");
	await using projectB = await createProject(db, "Progress Isolation B");

	const sharedRubricId = "shared-q-progress-iso";
	const sharedCriterionId = "shared-criterion-progress-iso";

	const targetA = await createGradeTarget(db, projectA.rowId);
	const targetB = await createGradeTarget(db, projectB.rowId);
	await createRubric(db, projectA.rowId, sharedRubricId, {
		criterionId: sharedCriterionId,
	});
	const { rubricRowId: rubricBRowId, criterionRowId: criterionBRowId } =
		await createRubric(db, projectB.rowId, sharedRubricId, {
			criterionId: sharedCriterionId,
		});

	// Add assessment only for project B
	if (criterionBRowId == null) throw new Error("Expected criterion row");
	await addAssessment(db, {
		projectRowId: projectB.rowId,
		gradeTargetRowId: targetB.rowId,
		rubricRowId: rubricBRowId,
		criterionRowId: criterionBRowId,
	});

	const progressA = await loadAssessedCriterionCountsByTargetFromDb(db, {
		rubricId: sharedRubricId,
		projectId: projectA.id,
	});
	const progressB = await loadAssessedCriterionCountsByTargetFromDb(db, {
		rubricId: sharedRubricId,
		projectId: projectB.id,
	});

	// Project A target has no assessment — should show 0 completed
	expect(progressA[targetA.id]).toEqual({ completed: 0, total: 1 });

	// Project B target has a complete assessment — should show 1 completed
	expect(progressB[targetB.id]).toEqual({ completed: 1, total: 1 });

	// Each project's result contains only its own single target — ids are
	// per-project ordinals, so targetA.id and targetB.id legitimately collide
	// (both "t-1"); isolation means each map has exactly one entry, not that
	// the id values differ.
	expect(Object.keys(progressA)).toEqual([targetA.id]);
	expect(Object.keys(progressB)).toEqual([targetB.id]);
});

test("loadAssessmentCompletionByTargetFromDb counts only rubrics and assessments within the requested project when rubric ids collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(
		db,
		"Overview Progress Isolation A",
	);
	await using projectB = await createProject(
		db,
		"Overview Progress Isolation B",
	);

	const sharedRubricId = "shared-q-overview-iso";
	const sharedCriterionId = "shared-criterion-overview-iso";

	const targetA = await createGradeTarget(db, projectA.rowId);
	const targetB = await createGradeTarget(db, projectB.rowId);
	await createRubric(db, projectA.rowId, sharedRubricId, {
		criterionId: sharedCriterionId,
	});
	const { rubricRowId: rubricBRowId, criterionRowId: criterionBRowId } =
		await createRubric(db, projectB.rowId, sharedRubricId, {
			criterionId: sharedCriterionId,
		});

	// Add assessment only for project B
	if (criterionBRowId == null) throw new Error("Expected criterion row");
	await addAssessment(db, {
		projectRowId: projectB.rowId,
		gradeTargetRowId: targetB.rowId,
		rubricRowId: rubricBRowId,
		criterionRowId: criterionBRowId,
	});

	const overviewA = await loadAssessmentCompletionByTargetFromDb(db, {
		projectId: projectA.id,
	});
	const overviewB = await loadAssessmentCompletionByTargetFromDb(db, {
		projectId: projectB.id,
	});

	// Project A has 1 rubric, 0 completed for its target
	expect(overviewA[targetA.id]).toEqual({ completed: 0, total: 1 });

	// Project B has 1 rubric, 1 completed for its target
	expect(overviewB[targetB.id]).toEqual({ completed: 1, total: 1 });

	// Each project's result contains only its own single target — ids are
	// per-project ordinals, so targetA.id and targetB.id legitimately collide
	// (both "t-1"); isolation means each map has exactly one entry, not that
	// the id values differ.
	expect(Object.keys(overviewA)).toEqual([targetA.id]);
	expect(Object.keys(overviewB)).toEqual([targetB.id]);
});

test("loadAssessedCriterionCountsByTarget wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Progress Wrapper");
	const sharedRubricId = buildTestId("rubric");
	const target = await createGradeTarget(db, project.rowId);
	await createRubric(db, project.rowId, sharedRubricId, {
		criterionId: buildTestId("criterion"),
	});

	const progress = await loadAssessedCriterionCountsByTarget(
		{ rubricId: sharedRubricId, projectId: project.id },
		{ db },
	);

	expect(progress[target.id]).toEqual({ completed: 0, total: 1 });

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(
		assessedCriterionCountsByTargetCacheTags(sharedRubricId),
	);
});

test("loadAssessedCriterionCounts plus buildAssessedCriterionCountsByTarget matches the combined primitive, given the same target ids", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Progress Split");
	const rubricId = buildTestId("rubric");
	const target = await createGradeTarget(db, project.rowId);
	await createRubric(db, project.rowId, rubricId, {
		criterionId: buildTestId("criterion"),
	});

	const combined = await loadAssessedCriterionCountsByTargetFromDb(db, {
		rubricId,
		projectId: project.id,
	});

	// Reuses an already-loaded target id instead of letting the counts
	// primitive query grade targets itself (Finding 7).
	const counts = await loadAssessedCriterionCounts(
		{ rubricId, projectId: project.id },
		{ db },
	);
	const split = buildAssessedCriterionCountsByTarget([target.id], counts);

	expect(split).toEqual(combined);
});

test("loadAssessmentCompletionByTarget is a plain deriver that shares loadAssessmentCompletionRows' cache entry", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Overview Progress Wrapper");
	const target = await createGradeTarget(db, project.rowId);
	await createRubric(db, project.rowId, buildTestId("rubric"), {
		criterionId: buildTestId("criterion"),
	});

	const overview = await loadAssessmentCompletionByTarget(
		{ projectId: project.id },
		{ db },
	);

	expect(overview[target.id]).toEqual({ completed: 0, total: 1 });

	// No own cache scope (ADR 0008 rule 5): only `loadAssessmentCompletionRows`
	// registers tags.
	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(assessmentCompletionRowsCacheTags());
});

test("a zero-criterion rubric counts as complete per target and consistently with the summary", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Zero Criterion Rubric");

	const target = await createGradeTarget(db, project.rowId);
	await createRubric(db, project.rowId, buildTestId("rubric"));

	const byTarget = await loadAssessmentCompletionByTargetFromDb(db, {
		projectId: project.id,
	});
	const summary = await loadAssessmentCompletionSummaryFromDb(db, {
		projectId: project.id,
	});

	expect(byTarget[target.id]).toEqual({ completed: 1, total: 1 });
	expect(summary.rubrics).toEqual({ completed: 1, total: 1 });
	expect(summary.gradeTargets).toEqual({ completed: 1, total: 1 });
});

test("loadAssessmentCompletionSummaryFromDb characterizes mixed completion across grade targets and rubrics", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Mixed Completion Summary");

	const targetDone = await createGradeTarget(db, project.rowId);
	await createGradeTarget(db, project.rowId);

	const { rubricRowId, criterionRowId } = await createRubric(
		db,
		project.rowId,
		buildTestId("rubric"),
		{ criterionId: buildTestId("criterion") },
	);
	if (criterionRowId == null) throw new Error("Expected criterion row");

	await addAssessment(db, {
		projectRowId: project.rowId,
		gradeTargetRowId: targetDone.rowId,
		rubricRowId,
		criterionRowId,
	});

	const summary = await loadAssessmentCompletionSummaryFromDb(db, {
		projectId: project.id,
	});

	expect(summary).toEqual({
		gradeTargets: { completed: 1, total: 2 },
		rubrics: { completed: 0, total: 1 },
		criteria: { completed: 1, total: 2 },
	});
});

test("loadAssessmentCompletionSummaryFromDb returns vacuous aggregates for an empty project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Empty Project Summary");

	const summary = await loadAssessmentCompletionSummaryFromDb(db, {
		projectId: project.id,
	});

	expect(summary).toEqual({
		gradeTargets: { completed: 0, total: 0 },
		rubrics: { completed: 0, total: 0 },
		criteria: { completed: 0, total: 0 },
	});
});

test("loadAssessmentCompletionSummary is a plain deriver that shares loadAssessmentCompletionRows' cache entry", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Summary Wrapper");
	await createGradeTarget(db, project.rowId);
	await createRubric(db, project.rowId, buildTestId("rubric"), {
		criterionId: buildTestId("criterion"),
	});

	const summary = await loadAssessmentCompletionSummary(
		{ projectId: project.id },
		{ db },
	);

	expect(summary).toEqual({
		gradeTargets: { completed: 0, total: 1 },
		rubrics: { completed: 0, total: 1 },
		criteria: { completed: 0, total: 1 },
	});

	// No own cache scope (ADR 0008 rule 5): registers the tags of the two cached
	// sources it composes, `loadAssessmentCompletionRows` and
	// `loadCriterionAssessmentsCount`.
	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual([
		...assessmentCompletionRowsCacheTags(),
		...criterionAssessmentsCountCacheTags(),
	]);
});
