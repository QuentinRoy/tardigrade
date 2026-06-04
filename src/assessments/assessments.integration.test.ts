import { type Kysely } from "kysely";
import { expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { createAssessmentFixture } from "#test/assessments.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { saveAssessmentInDb } from "./assessmentMutations.ts";
import { loadAssessmentFromDb } from "./assessments.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), updateTag: vi.fn() }));

// loadAssessment owns the global db + cache; this thin seam points the global db at
// the test db so the wrapper's declared cache tags can be asserted.
async function loadAssessmentWrapperWithDb(db: Kysely<DB>) {
	vi.resetModules();
	using _kyselyMock = vi.doMock("#db/kysely", () => ({ db }));

	return await import("./assessments.ts");
}

test("loadAssessmentFromDb returns an empty list when no assessment exists", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Assessment Read Empty Project",
	);
	const fixture = await createAssessmentFixture(db, project.id);

	const result = await loadAssessmentFromDb(
		db,
		fixture.submissionId,
		fixture.questionId,
	);

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

// Next caching is not active under vitest, so assert the observable seam: that
// loadAssessment declares "assessments:all" alongside its granular tag. Bulk imports
// only bust the coarse tag, so without this declaration the per-question grading view
// would serve stale data after an assessment import.
test("loadAssessment declares the assessments:all fallback tag", async () => {
	await using db = await createTestDb();
	const { loadAssessment } = await loadAssessmentWrapperWithDb(db);
	const { cacheTag } = await import("next/cache");
	await using project = await createProject(db, "Assessment Cache Tag Project");
	const fixture = await createAssessmentFixture(db, project.id);

	await loadAssessment(fixture.submissionId, fixture.questionId);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);

	expect(declaredTags).toContain("assessments:all");
	expect(declaredTags).toContain(
		`assessments:${fixture.submissionId}:${fixture.questionId}`,
	);
});
