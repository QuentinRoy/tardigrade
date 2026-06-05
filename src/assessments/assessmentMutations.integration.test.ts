import { type Kysely } from "kysely";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { createAssessmentFixture } from "#test/assessments.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { saveAssessmentInDb } from "./assessmentMutations.ts";
import { loadAssessmentFromDb } from "./assessments.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), updateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

// saveAssessment owns the global db + transaction + cache; this thin seam points the
// global db at the test db so the wrapper's invalidation can be asserted.
async function loadSaveAssessmentWrapperWithDb(db: Kysely<DB>) {
	vi.resetModules();
	using _kyselyMock = vi.doMock("#db/kysely", () => ({ db }));

	return await import("./assessmentMutations.ts");
}

test("saveAssessmentInDb round-trips boolean, ordinal and numerical assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Assessment Write Project");
	const fixture = await createAssessmentFixture(db, project.id);

	const results = await Promise.all([
		saveAssessmentInDb(db, {
			submissionId: fixture.submissionId,
			questionId: fixture.questionId,
			rubric: {
				rubricId: fixture.rubricIds.boolean,
				type: "boolean",
				passed: true,
			},
		}),
		saveAssessmentInDb(db, {
			submissionId: fixture.submissionId,
			questionId: fixture.questionId,
			rubric: {
				rubricId: fixture.rubricIds.ordinal,
				type: "ordinal",
				selectedLabel: "B",
			},
		}),
		saveAssessmentInDb(db, {
			submissionId: fixture.submissionId,
			questionId: fixture.questionId,
			rubric: {
				rubricId: fixture.rubricIds.numerical,
				type: "numerical",
				score: 7.5,
			},
		}),
	]);

	expect(results).toEqual([
		{ success: true },
		{ success: true },
		{ success: true },
	]);

	const loaded = await loadAssessmentFromDb(
		db,
		fixture.submissionId,
		fixture.questionId,
	);
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

test("saveAssessmentInDb returns a validation error for an invalid ordinal label", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Ordinal Error Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.ordinal,
			type: "ordinal",
			selectedLabel: "Z",
		},
	});

	expect(result).toEqual({
		success: false,
		error:
			"That option is no longer available. Reload and choose another option.",
	});
});

test("saveAssessmentInDb returns a validation error for an out-of-range numerical score", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Numerical Error Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await saveAssessmentInDb(db, {
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.numerical,
			type: "numerical",
			score: 11,
		},
	});

	expect(result).toEqual({
		success: false,
		error: "Enter a score of at most 10.",
	});
});

test("saveAssessmentInDb saves in the correct project when question and rubric ids collide", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(
		db,
		"Assessment Collision Project A",
	);
	await using projectB = await createProject(
		db,
		"Assessment Collision Project B",
	);

	const sharedQuestionId = buildTestId("shared-question");
	const sharedRubricIds = {
		boolean: buildTestId("shared-rubric-boolean"),
		ordinal: buildTestId("shared-rubric-ordinal"),
		numerical: buildTestId("shared-rubric-numerical"),
	};

	const fixtureA = await createAssessmentFixture(db, projectA.id, {
		questionId: sharedQuestionId,
		rubricIds: sharedRubricIds,
	});
	const fixtureB = await createAssessmentFixture(db, projectB.id, {
		questionId: sharedQuestionId,
		rubricIds: sharedRubricIds,
	});

	const result = await saveAssessmentInDb(db, {
		submissionId: fixtureB.submissionId,
		questionId: fixtureB.questionId,
		rubric: {
			rubricId: fixtureB.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});

	expect(result).toEqual({ success: true });

	const projectBAssessment = await loadAssessmentFromDb(
		db,
		fixtureB.submissionId,
		fixtureB.questionId,
	);
	expect(projectBAssessment).toEqual([
		{ rubricId: fixtureB.rubricIds.boolean, type: "boolean", passed: true },
	]);

	const projectAAssessment = await loadAssessmentFromDb(
		db,
		fixtureA.submissionId,
		fixtureA.questionId,
	);
	expect(projectAAssessment).toEqual([]);
});

test("saveAssessmentInDb rejects cross-project submission and question combinations", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(
		db,
		"Assessment Isolation Project A",
	);
	await using projectB = await createProject(
		db,
		"Assessment Isolation Project B",
	);

	const fixtureA = await createAssessmentFixture(db, projectA.id);
	const fixtureB = await createAssessmentFixture(db, projectB.id);

	const result = await saveAssessmentInDb(db, {
		submissionId: fixtureA.submissionId,
		questionId: fixtureB.questionId,
		rubric: {
			rubricId: fixtureB.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});

	expect(result).toEqual({
		success: false,
		error:
			"We couldn't match this grade to the selected student work. Reload and try again. If this keeps happening, report this issue.",
	});
});

test("saveAssessment wrapper invalidates the granular, coarse and question tags on success", async () => {
	await using db = await createTestDb();
	const { saveAssessment } = await loadSaveAssessmentWrapperWithDb(db);
	const { updateTag } = await import("next/cache");
	await using project = await createProject(
		db,
		"Assessment Save Cache Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await saveAssessment({
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.boolean,
			type: "boolean",
			passed: true,
		},
	});

	expect(result).toEqual({ success: true });

	const tags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(tags).toEqual([
		`assessments:${fixture.submissionId}:${fixture.questionId}`,
		"assessments",
		`assessments:question:${fixture.questionId}`,
	]);
});

test("saveAssessment wrapper does not invalidate when the save fails validation", async () => {
	await using db = await createTestDb();
	const { saveAssessment } = await loadSaveAssessmentWrapperWithDb(db);
	const { updateTag } = await import("next/cache");
	await using project = await createProject(
		db,
		"Assessment Save Cache Fail Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await saveAssessment({
		submissionId: fixture.submissionId,
		questionId: fixture.questionId,
		rubric: {
			rubricId: fixture.rubricIds.ordinal,
			type: "ordinal",
			selectedLabel: "Z",
		},
	});

	expect(result.success).toBe(false);
	expect(updateTag).not.toHaveBeenCalled();
});
