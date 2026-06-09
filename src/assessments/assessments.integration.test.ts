import { cacheTag } from "next/cache";
import { expect, test, vi } from "vitest";
import { createAssessmentFixture } from "#test/assessments.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { saveAssessmentInDb } from "./assessmentMutations.ts";
import { loadAssessment, loadAssessmentFromDb } from "./assessments.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), updateTag: vi.fn() }));

test("loadAssessmentFromDb returns an empty list when no assessment exists", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Read Empty Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await loadAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
	});

	expect(result).toEqual([]);
});

test("loadAssessmentFromDb returns the stored rubric values for a submission/question", async () => {
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

	const loaded = await loadAssessmentFromDb(db, {
		submissionId: fixture.submissionId,
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
test("loadAssessment wrapper delegates to its primitive and declares its cache tags", async () => {
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

	const loaded = await loadAssessment(
		{ submissionId: fixture.submissionId, questionId: fixture.questionId },
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
