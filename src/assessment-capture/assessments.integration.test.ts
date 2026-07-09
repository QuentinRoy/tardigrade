import { cacheTag } from "next/cache";
import { expect, test, vi } from "vitest";
import { saveAssessmentInDb } from "#assessment-persistence/assessmentMutations.ts";
import { createAssessmentFixture } from "#test/assessments.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { createBooleanRubricFixture } from "#test/rubrics.ts";
import {
	loadRubricAssessment,
	loadRubricAssessmentFromDb,
	loadSubmissionAssessments,
	loadSubmissionAssessmentsFromDb,
} from "./assessments.ts";

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
	updateTag: vi.fn(),
}));

test("loadRubricAssessmentFromDb returns an empty list when no assessment exists", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Read Empty Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await loadRubricAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: fixture.projectId,
		rubricId: fixture.rubricId,
	});

	expect(result).toEqual([]);
});

test("loadRubricAssessmentFromDb returns the stored criterion values for a submission/rubric", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Assessment Read Project");
	const fixture = await createAssessmentFixture(db, project.id);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.ordinal,
			kind: "options",
			selectedLabel: "B",
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.numerical,
			kind: "number",
			score: 7.5,
		},
	});

	const loaded = await loadRubricAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
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
// and declares "assessments:all" alongside its granular tag: bulk imports only bust
// the coarse tag, so without this declaration the per-rubric grading view would
// serve stale data after an assessment import.
test("loadRubricAssessment wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Assessment Cache Tag Project");
	const fixture = await createAssessmentFixture(db, project.id);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	const loaded = await loadRubricAssessment(
		{
			submissionId: fixture.submissionId,
			projectId: fixture.projectId,
			rubricId: fixture.rubricId,
		},
		{ db },
	);

	expect(loaded).toEqual([
		{ criterionId: fixture.criterionIds.boolean, kind: "check", passed: true },
	]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toContain("assessments:all");
	expect(declaredTags).toContain(
		`assessments:${fixture.submissionId}:${fixture.rubricId}`,
	);
});

test("loadSubmissionAssessmentsFromDb groups a submission's criterion values by rubric", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Submission Read Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);
	// Second rubric on the same submission's project, so the grouping across
	// rubrics is observable.
	const secondRubric = await createBooleanRubricFixture(db, project.rowId, 1);

	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.numerical,
			kind: "number",
			score: 7.5,
		},
	});
	await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		rubricId: secondRubric.rubricId,
		assessment: {
			criterionId: secondRubric.criterionId,
			kind: "check",
			passed: false,
		},
	});

	const byRubricId = await loadSubmissionAssessmentsFromDb(db, {
		submissionId: fixture.submissionId,
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

// Mirrors the loadRubricAssessment wrapper test: the whole-submission read must
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
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	const loaded = await loadSubmissionAssessments(
		{ submissionId: fixture.submissionId, projectId: fixture.projectId },
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
		rubricId: fixture.rubricId,
		assessment: {
			criterionId: fixture.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	const rubricAssessment = await loadRubricAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: projectB.id,
		rubricId: fixture.rubricId,
	});
	expect(rubricAssessment).toEqual([]);

	const submissionAssessments = await loadSubmissionAssessmentsFromDb(db, {
		submissionId: fixture.submissionId,
		projectId: projectB.id,
	});
	expect(submissionAssessments).toEqual({});
});
