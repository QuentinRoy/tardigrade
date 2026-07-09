import type { Kysely } from "kysely";
import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	assessedCriterionCountsBySubmissionCacheTags,
	assessmentCompletionRowsCacheTags,
	buildAssessedCriterionCountsBySubmission,
	criterionAssessmentsCountCacheTags,
	loadAssessedCriterionCounts,
	loadAssessedCriterionCountsBySubmission,
	loadAssessedCriterionCountsBySubmissionFromDb,
	loadAssessmentCompletionBySubmission,
	loadAssessmentCompletionBySubmissionFromDb,
	loadAssessmentCompletionSummary,
	loadAssessmentCompletionSummaryFromDb,
} from "./loadAssessmentCompletion.ts";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

async function createSubmission(
	db: Kysely<DB>,
	projectRowId: number,
): Promise<number> {
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

	const submission = await db
		.insertInto("submission")
		.values({
			projectId: projectRowId,
			type: "individual",
			studentId: studentRow.rowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	return submission.id;
}

async function createRubric(
	db: Kysely<DB>,
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
	db: Kysely<DB>,
	{
		projectRowId,
		submissionId,
		rubricRowId,
		criterionRowId,
	}: {
		projectRowId: number;
		submissionId: number;
		rubricRowId: number;
		criterionRowId?: number;
	},
): Promise<void> {
	const assessment = await db
		.insertInto("assessment")
		.values({ projectId: projectRowId, submissionId, rubricId: rubricRowId })
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

test("loadAssessedCriterionCountsBySubmissionFromDb counts only assessments within the requested project when rubric ids collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Progress Isolation A");
	await using projectB = await createProject(db, "Progress Isolation B");

	const sharedRubricId = "shared-q-progress-iso";
	const sharedCriterionId = "shared-criterion-progress-iso";

	const submissionA = await createSubmission(db, projectA.rowId);
	const submissionB = await createSubmission(db, projectB.rowId);
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
		submissionId: submissionB,
		rubricRowId: rubricBRowId,
		criterionRowId: criterionBRowId,
	});

	const progressA = await loadAssessedCriterionCountsBySubmissionFromDb(db, {
		rubricId: sharedRubricId,
		projectId: projectA.id,
	});
	const progressB = await loadAssessedCriterionCountsBySubmissionFromDb(db, {
		rubricId: sharedRubricId,
		projectId: projectB.id,
	});

	const submissionAId = String(submissionA);
	const submissionBId = String(submissionB);

	// Project A submission has no assessment — should show 0 completed
	expect(progressA[submissionAId]).toEqual({ completed: 0, total: 1 });

	// Project B submission has a complete assessment — should show 1 completed
	expect(progressB[submissionBId]).toEqual({ completed: 1, total: 1 });

	// Project A result must not contain project B's submission id
	expect(progressA[submissionBId]).toBeUndefined();

	// Project B result must not contain project A's submission id
	expect(progressB[submissionAId]).toBeUndefined();
});

test("loadAssessmentCompletionBySubmissionFromDb counts only rubrics and assessments within the requested project when rubric ids collide across projects", async () => {
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

	const submissionA = await createSubmission(db, projectA.rowId);
	const submissionB = await createSubmission(db, projectB.rowId);
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
		submissionId: submissionB,
		rubricRowId: rubricBRowId,
		criterionRowId: criterionBRowId,
	});

	const overviewA = await loadAssessmentCompletionBySubmissionFromDb(db, {
		projectId: projectA.id,
	});
	const overviewB = await loadAssessmentCompletionBySubmissionFromDb(db, {
		projectId: projectB.id,
	});

	const submissionAId = String(submissionA);
	const submissionBId = String(submissionB);

	// Project A has 1 rubric, 0 completed for its submission
	expect(overviewA[submissionAId]).toEqual({ completed: 0, total: 1 });

	// Project B has 1 rubric, 1 completed for its submission
	expect(overviewB[submissionBId]).toEqual({ completed: 1, total: 1 });

	// Results must not bleed across projects
	expect(overviewA[submissionBId]).toBeUndefined();
	expect(overviewB[submissionAId]).toBeUndefined();
});

test("loadAssessedCriterionCountsBySubmission wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Progress Wrapper");
	const sharedRubricId = buildTestId("rubric");
	const submissionId = await createSubmission(db, project.rowId);
	await createRubric(db, project.rowId, sharedRubricId, {
		criterionId: buildTestId("criterion"),
	});

	const progress = await loadAssessedCriterionCountsBySubmission(
		{ rubricId: sharedRubricId, projectId: project.id },
		{ db },
	);

	expect(progress[String(submissionId)]).toEqual({ completed: 0, total: 1 });

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(
		assessedCriterionCountsBySubmissionCacheTags(sharedRubricId),
	);
});

test("loadAssessedCriterionCounts plus buildAssessedCriterionCountsBySubmission matches the combined primitive, given the same submission ids", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Progress Split");
	const rubricId = buildTestId("rubric");
	const submissionId = await createSubmission(db, project.rowId);
	await createRubric(db, project.rowId, rubricId, {
		criterionId: buildTestId("criterion"),
	});

	const combined = await loadAssessedCriterionCountsBySubmissionFromDb(db, {
		rubricId,
		projectId: project.id,
	});

	// Reuses an already-loaded submission id instead of letting the counts
	// primitive query submissions itself (Finding 7).
	const counts = await loadAssessedCriterionCounts(
		{ rubricId, projectId: project.id },
		{ db },
	);
	const split = buildAssessedCriterionCountsBySubmission(
		[String(submissionId)],
		counts,
	);

	expect(split).toEqual(combined);
});

test("loadAssessmentCompletionBySubmission is a plain deriver that shares loadAssessmentCompletionRows' cache entry", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Overview Progress Wrapper");
	const submissionId = await createSubmission(db, project.rowId);
	await createRubric(db, project.rowId, buildTestId("rubric"), {
		criterionId: buildTestId("criterion"),
	});

	const overview = await loadAssessmentCompletionBySubmission(
		{ projectId: project.id },
		{ db },
	);

	expect(overview[String(submissionId)]).toEqual({ completed: 0, total: 1 });

	// No own cache scope (ADR 0008 rule 5): only `loadAssessmentCompletionRows`
	// registers tags.
	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(assessmentCompletionRowsCacheTags());
});

test("a zero-criterion rubric counts as complete per submission and consistently with the summary", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Zero Criterion Rubric");

	const submissionId = await createSubmission(db, project.rowId);
	await createRubric(db, project.rowId, buildTestId("rubric"));

	const bySubmission = await loadAssessmentCompletionBySubmissionFromDb(db, {
		projectId: project.id,
	});
	const summary = await loadAssessmentCompletionSummaryFromDb(db, {
		projectId: project.id,
	});

	expect(bySubmission[String(submissionId)]).toEqual({
		completed: 1,
		total: 1,
	});
	expect(summary.rubrics).toEqual({ completed: 1, total: 1 });
	expect(summary.submissions).toEqual({ completed: 1, total: 1 });
});

test("loadAssessmentCompletionSummaryFromDb characterizes mixed completion across submissions and rubrics", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Mixed Completion Summary");

	const submissionDone = await createSubmission(db, project.rowId);
	await createSubmission(db, project.rowId);

	const { rubricRowId, criterionRowId } = await createRubric(
		db,
		project.rowId,
		buildTestId("rubric"),
		{ criterionId: buildTestId("criterion") },
	);
	if (criterionRowId == null) throw new Error("Expected criterion row");

	await addAssessment(db, {
		projectRowId: project.rowId,
		submissionId: submissionDone,
		rubricRowId,
		criterionRowId,
	});

	const summary = await loadAssessmentCompletionSummaryFromDb(db, {
		projectId: project.id,
	});

	expect(summary).toEqual({
		submissions: { completed: 1, total: 2 },
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
		submissions: { completed: 0, total: 0 },
		rubrics: { completed: 0, total: 0 },
		criteria: { completed: 0, total: 0 },
	});
});

test("loadAssessmentCompletionSummary is a plain deriver that shares loadAssessmentCompletionRows' cache entry", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Summary Wrapper");
	await createSubmission(db, project.rowId);
	await createRubric(db, project.rowId, buildTestId("rubric"), {
		criterionId: buildTestId("criterion"),
	});

	const summary = await loadAssessmentCompletionSummary(
		{ projectId: project.id },
		{ db },
	);

	expect(summary).toEqual({
		submissions: { completed: 0, total: 1 },
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
