import type { Kysely } from "kysely";
import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	assessedRubricCountsBySubmissionCacheTags,
	assessmentCompletionBySubmissionCacheTags,
	assessmentCompletionSummaryCacheTags,
	loadAssessedRubricCountsBySubmission,
	loadAssessedRubricCountsBySubmissionFromDb,
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

async function createQuestion(
	db: Kysely<DB>,
	projectRowId: number,
	questionId: string,
	{ rubricId }: { rubricId?: string } = {},
): Promise<{ questionRowId: number; rubricRowId: number | null }> {
	await db
		.insertInto("question")
		.values({
			projectId: projectRowId,
			id: questionId,
			label: "Shared Q",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select(["rowId"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	if (rubricId == null) {
		return { questionRowId: question.rowId, rubricRowId: null };
	}

	const rubricRows = await db
		.insertInto("rubric")
		.values({
			id: rubricId,
			projectId: projectRowId,
			questionId: question.rowId,
			type: "boolean",
			position: 0,
			label: "Correct",
		})
		.returning(["rowId"])
		.execute();

	const rubric = rubricRows[0];
	if (rubric == null) throw new Error("Expected rubric row");

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: rubric.rowId, marks: 1, falseMarks: 0 })
		.execute();

	return { questionRowId: question.rowId, rubricRowId: rubric.rowId };
}

async function addAssessment(
	db: Kysely<DB>,
	{
		projectRowId,
		submissionId,
		questionRowId,
		rubricRowId,
	}: {
		projectRowId: number;
		submissionId: number;
		questionRowId: number;
		rubricRowId?: number;
	},
): Promise<void> {
	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId: projectRowId,
			submissionId,
			questionId: questionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	if (rubricRowId == null) {
		return;
	}

	await db
		.insertInto("rubricAssessment")
		.values({
			assessmentId: assessment.id,
			rubricId: rubricRowId,
			type: "boolean",
		})
		.execute();

	const rubricAssessment = await db
		.selectFrom("rubricAssessment")
		.select("id")
		.where("assessmentId", "=", assessment.id)
		.where("rubricId", "=", rubricRowId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubricAssessment")
		.values({ rubricAssessmentId: rubricAssessment.id, passed: true })
		.execute();
}

test("loadAssessedRubricCountsBySubmissionFromDb counts only assessments within the requested project when question ids collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Progress Isolation A");
	await using projectB = await createProject(db, "Progress Isolation B");

	const sharedQuestionId = "shared-q-progress-iso";
	const sharedRubricId = "shared-rubric-progress-iso";

	const submissionA = await createSubmission(db, projectA.rowId);
	const submissionB = await createSubmission(db, projectB.rowId);
	await createQuestion(db, projectA.rowId, sharedQuestionId, {
		rubricId: sharedRubricId,
	});
	const { questionRowId: questionBRowId, rubricRowId: rubricBRowId } =
		await createQuestion(db, projectB.rowId, sharedQuestionId, {
			rubricId: sharedRubricId,
		});

	// Add assessment only for project B
	if (rubricBRowId == null) throw new Error("Expected rubric row");
	await addAssessment(db, {
		projectRowId: projectB.rowId,
		submissionId: submissionB,
		questionRowId: questionBRowId,
		rubricRowId: rubricBRowId,
	});

	const progressA = await loadAssessedRubricCountsBySubmissionFromDb(db, {
		questionId: sharedQuestionId,
		projectId: projectA.id,
	});
	const progressB = await loadAssessedRubricCountsBySubmissionFromDb(db, {
		questionId: sharedQuestionId,
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

test("loadAssessmentCompletionBySubmissionFromDb counts only questions and assessments within the requested project when question ids collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(
		db,
		"Overview Progress Isolation A",
	);
	await using projectB = await createProject(
		db,
		"Overview Progress Isolation B",
	);

	const sharedQuestionId = "shared-q-overview-iso";
	const sharedRubricId = "shared-rubric-overview-iso";

	const submissionA = await createSubmission(db, projectA.rowId);
	const submissionB = await createSubmission(db, projectB.rowId);
	await createQuestion(db, projectA.rowId, sharedQuestionId, {
		rubricId: sharedRubricId,
	});
	const { questionRowId: questionBRowId, rubricRowId: rubricBRowId } =
		await createQuestion(db, projectB.rowId, sharedQuestionId, {
			rubricId: sharedRubricId,
		});

	// Add assessment only for project B
	if (rubricBRowId == null) throw new Error("Expected rubric row");
	await addAssessment(db, {
		projectRowId: projectB.rowId,
		submissionId: submissionB,
		questionRowId: questionBRowId,
		rubricRowId: rubricBRowId,
	});

	const overviewA = await loadAssessmentCompletionBySubmissionFromDb(db, {
		projectId: projectA.id,
	});
	const overviewB = await loadAssessmentCompletionBySubmissionFromDb(db, {
		projectId: projectB.id,
	});

	const submissionAId = String(submissionA);
	const submissionBId = String(submissionB);

	// Project A has 1 question, 0 completed for its submission
	expect(overviewA[submissionAId]).toEqual({ completed: 0, total: 1 });

	// Project B has 1 question, 1 completed for its submission
	expect(overviewB[submissionBId]).toEqual({ completed: 1, total: 1 });

	// Results must not bleed across projects
	expect(overviewA[submissionBId]).toBeUndefined();
	expect(overviewB[submissionAId]).toBeUndefined();
});

test("loadAssessedRubricCountsBySubmission wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Question Progress Wrapper");
	const sharedQuestionId = buildTestId("question");
	const submissionId = await createSubmission(db, project.rowId);
	await createQuestion(db, project.rowId, sharedQuestionId, {
		rubricId: buildTestId("rubric"),
	});

	const progress = await loadAssessedRubricCountsBySubmission(
		{ questionId: sharedQuestionId, projectId: project.id },
		{ db },
	);

	expect(progress[String(submissionId)]).toEqual({ completed: 0, total: 1 });

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(
		assessedRubricCountsBySubmissionCacheTags(sharedQuestionId),
	);
});

test("loadAssessmentCompletionBySubmission wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Overview Progress Wrapper");
	const submissionId = await createSubmission(db, project.rowId);
	await createQuestion(db, project.rowId, buildTestId("question"), {
		rubricId: buildTestId("rubric"),
	});

	const overview = await loadAssessmentCompletionBySubmission(
		{ projectId: project.id },
		{ db },
	);

	expect(overview[String(submissionId)]).toEqual({ completed: 0, total: 1 });

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(assessmentCompletionBySubmissionCacheTags());
});

test("a zero-rubric question counts as complete per submission and consistently with the summary", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Zero Rubric Question");

	const submissionId = await createSubmission(db, project.rowId);
	await createQuestion(db, project.rowId, buildTestId("question"));

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
	expect(summary.questions).toEqual({ completed: 1, total: 1 });
	expect(summary.submissions).toEqual({ completed: 1, total: 1 });
});

test("loadAssessmentCompletionSummaryFromDb characterizes mixed completion across submissions and questions", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Mixed Completion Summary");

	const submissionDone = await createSubmission(db, project.rowId);
	await createSubmission(db, project.rowId);

	const { questionRowId, rubricRowId } = await createQuestion(
		db,
		project.rowId,
		buildTestId("question"),
		{ rubricId: buildTestId("rubric") },
	);
	if (rubricRowId == null) throw new Error("Expected rubric row");

	await addAssessment(db, {
		projectRowId: project.rowId,
		submissionId: submissionDone,
		questionRowId,
		rubricRowId,
	});

	const summary = await loadAssessmentCompletionSummaryFromDb(db, {
		projectId: project.id,
	});

	expect(summary).toEqual({
		submissions: { completed: 1, total: 2 },
		questions: { completed: 0, total: 1 },
		rubrics: { completed: 1, total: 2 },
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
		questions: { completed: 0, total: 0 },
		rubrics: { completed: 0, total: 0 },
	});
});

test("loadAssessmentCompletionSummary wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Summary Wrapper");
	await createSubmission(db, project.rowId);
	await createQuestion(db, project.rowId, buildTestId("question"), {
		rubricId: buildTestId("rubric"),
	});

	const summary = await loadAssessmentCompletionSummary(
		{ projectId: project.id },
		{ db },
	);

	expect(summary).toEqual({
		submissions: { completed: 0, total: 1 },
		questions: { completed: 0, total: 1 },
		rubrics: { completed: 0, total: 1 },
	});

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(assessmentCompletionSummaryCacheTags());
});
