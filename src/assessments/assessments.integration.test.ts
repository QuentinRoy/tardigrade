import { cacheTag } from "next/cache";
import { expect, test, vi } from "vitest";
import { createAssessmentFixture } from "#test/assessments.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { createBooleanQuestionFixture } from "#test/questions.ts";
import { saveAssessmentInDb } from "./assessmentMutations.ts";
import {
	loadQuestionAssessment,
	loadQuestionAssessmentFromDb,
	loadSubmissionAssessments,
	loadSubmissionAssessmentsFromDb,
} from "./assessments.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), updateTag: vi.fn() }));

test("loadQuestionAssessmentFromDb returns an empty list when no assessment exists", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Read Empty Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await loadQuestionAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: fixture.projectId,
		questionId: fixture.questionId,
	});

	expect(result).toEqual([]);
});

test("loadQuestionAssessmentFromDb returns the stored rubric values for a submission/question", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Assessment Read Project");
	const fixture = await createAssessmentFixture(db, project.id);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.ordinal,
			type: "ordinal",
			selectedLabel: "B",
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.numerical,
			type: "numerical",
			score: 7.5,
		},
	});

	const loaded = await loadQuestionAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: fixture.projectId,
		questionId: fixture.questionId,
	});

	const byRubricId = new Map(loaded.map((value) => [value.rubricId, value]));

	expect(byRubricId.get(fixture.rubricIds.boolean)).toEqual({
		rubricId: fixture.rubricIds.boolean,
		type: "boolean",
		passed: true,
	});
	expect(byRubricId.get(fixture.rubricIds.ordinal)).toEqual({
		rubricId: fixture.rubricIds.ordinal,
		type: "ordinal",
		selectedLabel: "B",
	});
	expect(byRubricId.get(fixture.rubricIds.numerical)).toEqual({
		rubricId: fixture.rubricIds.numerical,
		type: "numerical",
		score: 7.5,
	});
});

// Next caching is inert under vitest, so the read wrapper runs directly against the
// injected handle. Assert it delegates to its primitive (returns the test db's rows)
// and declares "assessments:all" alongside its granular tag: bulk imports only bust
// the coarse tag, so without this declaration the per-question grading view would
// serve stale data after an assessment import.
test("loadQuestionAssessment wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Assessment Cache Tag Project");
	const fixture = await createAssessmentFixture(db, project.id);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});

	const loaded = await loadQuestionAssessment(
		{
			submissionId: fixture.submissionId,
			projectId: fixture.projectId,
			questionId: fixture.questionId,
		},
		{ db },
	);

	expect(loaded).toEqual([
		{ rubricId: fixture.rubricIds.boolean, type: "boolean", passed: true },
	]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toContain("assessments:all");
	expect(declaredTags).toContain(
		`assessments:${fixture.submissionId}:${fixture.questionId}`,
	);
});

test("loadSubmissionAssessmentsFromDb groups a submission's rubric values by question", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Submission Read Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);
	// Second question on the same submission's project, so the grouping across
	// questions is observable.
	const secondQuestion = await createBooleanQuestionFixture(
		db,
		project.rowId,
		1,
	);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.numerical,
			type: "numerical",
			score: 7.5,
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: secondQuestion.questionId,
		rubric: {
			rubricId: secondQuestion.rubricId,
			type: "boolean",
			passed: false,
		},
	});

	const byQuestionId = await loadSubmissionAssessmentsFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: fixture.projectId,
	});

	expect(Object.keys(byQuestionId).toSorted()).toEqual(
		[fixture.questionId, secondQuestion.questionId].toSorted(),
	);
	expect(byQuestionId[fixture.questionId]).toEqual(
		expect.arrayContaining([
			{ rubricId: fixture.rubricIds.boolean, type: "boolean", passed: true },
			{ rubricId: fixture.rubricIds.numerical, type: "numerical", score: 7.5 },
		]),
	);
	expect(byQuestionId[secondQuestion.questionId]).toEqual([
		{ rubricId: secondQuestion.rubricId, type: "boolean", passed: false },
	]);
});

// Mirrors the loadQuestionAssessment wrapper test: the whole-submission read must
// declare the submission-scoped tag (busted by individual saves) and
// "assessments:all" (busted by bulk imports) or the overview would serve stale data.
test("loadSubmissionAssessments wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Submission Cache Tag Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});

	const loaded = await loadSubmissionAssessments(
		{ submissionId: fixture.submissionId, projectId: fixture.projectId },
		{ db },
	);

	expect(loaded).toEqual({
		[fixture.questionId]: [
			{ rubricId: fixture.rubricIds.boolean, type: "boolean", passed: true },
		],
	});

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toContain("assessments:all");
	expect(declaredTags).toContain(`assessments:${fixture.submissionId}`);
});

// The reads scope by Project ID; a mismatched Project ID must not leak another
// project's data.
test("assessment reads return nothing when the Project ID does not match the submission", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Assessment Scope Project A");
	await using projectB = await createProject(db, "Assessment Scope Project B");
	const fixture = await createAssessmentFixture(db, projectA.id);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});

	const questionAssessment = await loadQuestionAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: projectB.id,
		questionId: fixture.questionId,
	});
	expect(questionAssessment).toEqual([]);

	const submissionAssessments = await loadSubmissionAssessmentsFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: projectB.id,
	});
	expect(submissionAssessments).toEqual({});
});
