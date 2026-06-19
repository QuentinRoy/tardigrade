import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanQuestionFixture,
	createOrdinalQuestionFixture,
} from "#test/questions.ts";
import {
	loadQuestion,
	loadQuestionGrid,
	loadQuestionRows,
	loadQuestionRowsFromDb,
	questionCacheTags,
} from "./questions.ts";

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

test("loadQuestionGrid forwards its db option to the shared loadQuestionRows source", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Grid Forwarding Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const grid = await loadQuestionGrid({ projectId: project.id }, { db });

	expect(Object.keys(grid)).toEqual([fixture.questionId]);
	expect(grid[fixture.questionId]?.rubrics.map((rubric) => rubric.id)).toEqual([
		fixture.rubricId,
	]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(questionCacheTags());
});

test("loadQuestion forwards its db option to the shared loadQuestionRows source", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Question Forwarding Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const question = await loadQuestion(
		{ projectId: project.id, questionId: fixture.questionId },
		{ db },
	);

	expect(question?.rubrics.map((rubric) => rubric.id)).toEqual([
		fixture.rubricId,
	]);
});

test("loadQuestionRowsFromDb returns ordinalRubric with empty marks when the ordinalRubric row exists but has no ordinalRubricValue rows", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Ordinal Empty Marks Project");

	const { questionId, rubricId } = await createOrdinalQuestionFixture(
		db,
		project.rowId,
	);

	await db
		.deleteFrom("ordinalRubricValue")
		.where(
			"ordinalRubricId",
			"in",
			db
				.selectFrom("ordinalRubric")
				.innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
				.where("rubric.id", "=", rubricId)
				.select("ordinalRubric.id"),
		)
		.execute();

	const rows = await loadQuestionRowsFromDb(db, { projectId: project.id });

	expect(rows).toEqual([
		{
			id: questionId,
			label: "Ordinal question",
			rubrics: [
				{
					id: rubricId,
					type: "ordinal",
					description: null,
					label: "Ordinal",
					booleanRubric: null,
					ordinalRubric: { marks: [] },
					numericalRubric: null,
				},
			],
		},
	]);
});
