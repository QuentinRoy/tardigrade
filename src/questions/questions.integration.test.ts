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
			criteria: [
				{
					id: fixture.criterionId,
					kind: "check",
					description: null,
					label: "Correct",
					checkCriterion: { marks: 2, falseMarks: 0 },
					optionsCriterion: null,
					numberCriterion: null,
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
	expect(
		grid[fixture.questionId]?.criteria.map((criterion) => criterion.id),
	).toEqual([fixture.criterionId]);

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

	expect(question?.criteria.map((criterion) => criterion.id)).toEqual([
		fixture.criterionId,
	]);
});

test("loadQuestionRowsFromDb returns optionsCriterion with empty marks when the optionsCriterion row exists but has no optionsCriterionMark rows", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Ordinal Empty Marks Project");

	const { questionId, criterionId } = await createOrdinalQuestionFixture(
		db,
		project.rowId,
	);

	await db
		.deleteFrom("optionsCriterionMark")
		.where(
			"optionsCriterionId",
			"in",
			db
				.selectFrom("optionsCriterion")
				.innerJoin(
					"criterion",
					"criterion.rowId",
					"optionsCriterion.criterionId",
				)
				.where("criterion.id", "=", criterionId)
				.select("optionsCriterion.id"),
		)
		.execute();

	const rows = await loadQuestionRowsFromDb(db, { projectId: project.id });

	expect(rows).toEqual([
		{
			id: questionId,
			label: "Ordinal question",
			criteria: [
				{
					id: criterionId,
					kind: "options",
					description: null,
					label: "Ordinal",
					checkCriterion: null,
					optionsCriterion: { marks: [] },
					numberCriterion: null,
				},
			],
		},
	]);
});
