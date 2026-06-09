import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { createAssessedBooleanQuestionFixture } from "#test/questions.ts";
import {
	loadQuestionGrid,
	loadQuestionRows,
	loadQuestionRowsFromDb,
	questionCacheTags,
} from "./questions.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

test("loadQuestionRowsFromDb returns only the rows scoped to the given project", async () => {
	await using db = await createTestDb();

	await using project = await createProject(db, "Read Seam Project");
	await using otherProject = await createProject(db, "Read Seam Other Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	await createAssessedBooleanQuestionFixture(db, otherProject.rowId);

	const rows = await loadQuestionRowsFromDb(db, { projectId: project.id });

	expect(rows).toEqual([
		{
			id: fixture.questionId,
			label: "Boolean question",
			rubrics: [
				{
					id: fixture.rubricId,
					type: "boolean",
					description: null,
					label: "Correct",
					booleanRubric: { marks: 2, falseMarks: 0 },
					ordinalRubric: null,
					numericalRubric: null,
				},
			],
		},
	]);
});

test("loadQuestionRows wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rows Wrapper Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const rows = await loadQuestionRows({ projectId: project.id }, { db });

	expect(rows.map((row) => row.id)).toEqual([fixture.questionId]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(questionCacheTags());
});

test("loadQuestionGrid wrapper returns the rubric grid through the injected handle", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Grid Wrapper Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const grid = await loadQuestionGrid({ projectId: project.id }, { db });

	expect(Object.keys(grid)).toEqual([fixture.questionId]);
	expect(grid[fixture.questionId]?.rubrics.map((rubric) => rubric.id)).toEqual([
		fixture.rubricId,
	]);
});
