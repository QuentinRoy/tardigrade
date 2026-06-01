import { type Kysely } from "kysely";
import { expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { createAssessedBooleanQuestionFixture } from "#test/questions.ts";
import type { DB } from "./generated/db.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
	updateTag: vi.fn(),
}));

async function loadQuestionsReadWithDb(db: Kysely<DB>) {
	vi.resetModules();
	using _kyselyMock = vi.doMock("./kysely", () => ({ db }));

	return await import("./questions.ts");
}

test("loadQuestions returns scoped grid and loadQuestion returns a single question", async () => {
	await using db = await createTestDb();
	const { loadQuestions, loadQuestion } = await loadQuestionsReadWithDb(db);

	await using project = await createProject(db, "Read Seam Project");
	await using otherProject = await createProject(db, "Read Seam Other Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	await createAssessedBooleanQuestionFixture(db, otherProject.rowId);

	const grid = await loadQuestions(project.id);

	expect(Object.keys(grid)).toEqual([fixture.questionId]);
	expect(grid[fixture.questionId]).toEqual({
		label: "Boolean question",
		rubrics: [
			{
				id: fixture.rubricId,
				label: "Correct",
				description: undefined,
				type: "boolean",
				marks: 2,
				falseMarks: 0,
			},
		],
	});

	const question = await loadQuestion(fixture.questionId, project.id);
	expect(question).toEqual(grid[fixture.questionId]);

	const missing = await loadQuestion(fixture.questionId, otherProject.id);
	expect(missing).toBeUndefined();
});
