import { type Kysely } from "kysely";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { saveQuestionsInDb } from "./saveQuestions.ts";
import type { ImportedQuestions } from "./types.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

// saveQuestions owns the global db + transaction + cache; this thin seam points the
// global db at the test db so the wrapper's invalidation can be asserted.
async function loadSaveQuestionsWrapperWithDb(db: Kysely<DB>) {
	vi.resetModules();
	using _kyselyMock = vi.doMock("#db/kysely", () => ({ db }));

	return await import("./saveQuestions.ts");
}

function makeQuestions(params: {
	questionLabel: string;
	rubricLabel: string;
}): ImportedQuestions {
	return [
		{
			id: "q1",
			label: params.questionLabel,
			rubrics: [
				{
					id: "r1",
					type: "boolean",
					label: params.rubricLabel,
					marks: 2,
					falseMarks: 0,
				},
			],
		},
	];
}

test("saveQuestionsInDb allows the same question and rubric ids in different projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Import Project A");
	await using projectB = await createProject(db, "Import Project B");

	const resultA = await saveQuestionsInDb(db, {
		questions: makeQuestions({
			questionLabel: "Question A",
			rubricLabel: "Rubric A",
		}),
		projectId: projectA.id,
	});

	const resultB = await saveQuestionsInDb(db, {
		questions: makeQuestions({
			questionLabel: "Question B",
			rubricLabel: "Rubric B",
		}),
		projectId: projectB.id,
	});

	expect(resultA).toEqual({ questionCount: 1, rubricCount: 1 });
	expect(resultB).toEqual({ questionCount: 1, rubricCount: 1 });

	const questions = await db
		.selectFrom("question")
		.select(["projectId", "id", "label"])
		.where("id", "=", "q1")
		.orderBy("projectId", "asc")
		.execute();

	expect(questions).toHaveLength(2);
	expect(questions[0]?.label).toBe("Question A");
	expect(questions[1]?.label).toBe("Question B");

	const rubrics = await db
		.selectFrom("rubric")
		.select(["projectId", "id", "label"])
		.where("id", "=", "r1")
		.orderBy("projectId", "asc")
		.execute();

	expect(rubrics).toHaveLength(2);
	expect(rubrics[0]?.label).toBe("Rubric A");
	expect(rubrics[1]?.label).toBe("Rubric B");
});

test("saveQuestionsInDb updates only the target project rows", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Isolation Project A");
	await using projectB = await createProject(db, "Isolation Project B");

	await saveQuestionsInDb(db, {
		questions: makeQuestions({
			questionLabel: "A initial",
			rubricLabel: "A rubric initial",
		}),
		projectId: projectA.id,
	});

	await saveQuestionsInDb(db, {
		questions: makeQuestions({
			questionLabel: "B initial",
			rubricLabel: "B rubric initial",
		}),
		projectId: projectB.id,
	});

	await saveQuestionsInDb(db, {
		questions: makeQuestions({
			questionLabel: "A updated",
			rubricLabel: "A rubric updated",
		}),
		projectId: projectA.id,
	});

	const questionA = await db
		.selectFrom("question")
		.select(["label"])
		.where("projectId", "=", projectA.rowId)
		.where("id", "=", "q1")
		.executeTakeFirstOrThrow();

	const questionB = await db
		.selectFrom("question")
		.select(["label"])
		.where("projectId", "=", projectB.rowId)
		.where("id", "=", "q1")
		.executeTakeFirstOrThrow();

	const rubricA = await db
		.selectFrom("rubric")
		.select(["label"])
		.where("projectId", "=", projectA.rowId)
		.where("id", "=", "r1")
		.executeTakeFirstOrThrow();

	const rubricB = await db
		.selectFrom("rubric")
		.select(["label"])
		.where("projectId", "=", projectB.rowId)
		.where("id", "=", "r1")
		.executeTakeFirstOrThrow();

	expect(questionA.label).toBe("A updated");
	expect(questionB.label).toBe("B initial");
	expect(rubricA.label).toBe("A rubric updated");
	expect(rubricB.label).toBe("B rubric initial");
});

test("saveQuestionsInDb still upserts duplicate ids within the same project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Single Project Upsert");
	const projectRowId = project.rowId;

	await saveQuestionsInDb(db, {
		questions: makeQuestions({
			questionLabel: "Before",
			rubricLabel: "Rubric before",
		}),
		projectId: project.id,
	});

	await saveQuestionsInDb(db, {
		questions: makeQuestions({
			questionLabel: "After",
			rubricLabel: "Rubric after",
		}),
		projectId: project.id,
	});

	const questions = await db
		.selectFrom("question")
		.select(["id", "label"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", "q1")
		.execute();

	const rubrics = await db
		.selectFrom("rubric")
		.select(["id", "label"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", "r1")
		.execute();

	expect(questions).toHaveLength(1);
	expect(rubrics).toHaveLength(1);
	expect(questions[0]?.label).toBe("After");
	expect(rubrics[0]?.label).toBe("Rubric after");
});

test("saveQuestions wrapper invalidates question and assessment tags after the import commits", async () => {
	await using db = await createTestDb();
	const { saveQuestions } = await loadSaveQuestionsWrapperWithDb(db);
	const { revalidateTag } = await import("next/cache");
	await using project = await createProject(
		db,
		"Import Questions Cache Project",
	);

	await saveQuestions(
		makeQuestions({ questionLabel: "Q", rubricLabel: "R" }),
		project.id,
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["questions", "max"],
		["assessments", "max"],
		["assessments:all", "max"],
	]);
});
