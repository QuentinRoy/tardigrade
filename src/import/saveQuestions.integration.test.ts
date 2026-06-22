import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanQuestionFixture,
	createBooleanQuestionFixture,
} from "#test/questions.ts";
import { prepareQuestionImport } from "./prepareQuestionImport.ts";
import { loadQuestionImportContextFromDb } from "./questionImportContext.ts";
import { saveQuestionImportPlanInDb, saveQuestions } from "./saveQuestions.ts";
import type { ImportedQuestions } from "./types.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

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

test("saveQuestions allows the same question and rubric ids in different projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Import Project A");
	await using projectB = await createProject(db, "Import Project B");

	const resultA = await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "Question A",
				rubricLabel: "Rubric A",
			}),
			projectId: projectA.id,
		},
		{ db },
	);

	const resultB = await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "Question B",
				rubricLabel: "Rubric B",
			}),
			projectId: projectB.id,
		},
		{ db },
	);

	expect(resultA).toEqual({
		questionCount: 1,
		rubricCount: 1,
		typeChangedRubricCount: 0,
	});
	expect(resultB).toEqual({
		questionCount: 1,
		rubricCount: 1,
		typeChangedRubricCount: 0,
	});

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

test("saveQuestions updates only the target project rows", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Isolation Project A");
	await using projectB = await createProject(db, "Isolation Project B");

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "A initial",
				rubricLabel: "A rubric initial",
			}),
			projectId: projectA.id,
		},
		{ db },
	);

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "B initial",
				rubricLabel: "B rubric initial",
			}),
			projectId: projectB.id,
		},
		{ db },
	);

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "A updated",
				rubricLabel: "A rubric updated",
			}),
			projectId: projectA.id,
		},
		{ db },
	);

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

test("saveQuestions still upserts duplicate ids within the same project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Single Project Upsert");
	const projectRowId = project.rowId;

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "Before",
				rubricLabel: "Rubric before",
			}),
			projectId: project.id,
		},
		{ db },
	);

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "After",
				rubricLabel: "Rubric after",
			}),
			projectId: project.id,
		},
		{ db },
	);

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

test("saveQuestions blocks a rubric type change when the rubric has linked assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Type Change Blocked Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const questions: ImportedQuestions = [
		{
			id: fixture.questionId,
			label: "Boolean question",
			rubrics: [
				{
					id: fixture.rubricId,
					type: "ordinal",
					label: "Correct",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	await expect(
		saveQuestions({ questions, projectId: project.id }, { db }),
	).rejects.toThrow(
		`Rubric "${fixture.rubricId}" of question "${fixture.questionId}" has 1 linked assessments and cannot change type on import.`,
	);

	const rubric = await db
		.selectFrom("rubric")
		.select("type")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.rubricId)
		.executeTakeFirstOrThrow();

	expect(rubric.type).toBe("boolean");
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("saveQuestions allows a rubric type change when the rubric has no linked assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Type Change Allowed Project");
	const fixture = await createBooleanQuestionFixture(db, project.rowId);

	const questions: ImportedQuestions = [
		{
			id: fixture.questionId,
			label: "Boolean question",
			rubrics: [
				{
					id: fixture.rubricId,
					type: "ordinal",
					label: "Correct",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	const result = await saveQuestions(
		{ questions, projectId: project.id },
		{ db },
	);

	expect(result).toEqual({
		questionCount: 1,
		rubricCount: 1,
		typeChangedRubricCount: 1,
	});

	const rubric = await db
		.selectFrom("rubric")
		.select("type")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.rubricId)
		.executeTakeFirstOrThrow();

	expect(rubric.type).toBe("ordinal");

	const ordinalRubricValues = await db
		.selectFrom("ordinalRubric")
		.innerJoin(
			"ordinalRubricValue",
			"ordinalRubricValue.ordinalRubricId",
			"ordinalRubric.id",
		)
		.innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
		.select(["ordinalRubricValue.label", "ordinalRubricValue.marks"])
		.where("rubric.id", "=", fixture.rubricId)
		.execute();

	expect(ordinalRubricValues.map((value) => value.label).sort()).toEqual([
		"bad",
		"good",
	]);
});

test("saveQuestions blocks an imported rubric id that already belongs to another question", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Mismatch Project");
	const fixture = await createBooleanQuestionFixture(db, project.rowId);

	const questions: ImportedQuestions = [
		{
			id: "another-question",
			label: "Another question",
			rubrics: [
				{ id: fixture.rubricId, type: "boolean", label: "Correct", marks: 2 },
			],
		},
	];

	await expect(
		saveQuestions({ questions, projectId: project.id }, { db }),
	).rejects.toThrow(
		`Rubric "${fixture.rubricId}" already belongs to question "${fixture.questionId}" and cannot be moved to question "another-question" on import.`,
	);

	const rubric = await db
		.selectFrom("rubric")
		.select("questionId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.rubricId)
		.executeTakeFirstOrThrow();

	expect(rubric.questionId).toBe(fixture.questionRowId);
});

test("saveQuestions wrapper invalidates question and assessment tags after the import commits", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Import Questions Cache Project",
	);

	await saveQuestions(
		{
			questions: makeQuestions({ questionLabel: "Q", rubricLabel: "R" }),
			projectId: project.id,
		},
		{ db },
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["questions", "max"],
		["assessments", "max"],
		["assessments:all", "max"],
	]);
});

// Lighter, overlap-invariant coverage (per the plan): assert the row-level
// contract only (no corruption, no thrown error, last-write-wins), not
// reported counts. Targets the rubric delete-then-recreate path on a type
// change (`saveQuestions.ts`), the spot most plausible to misbehave since the
// subtype tables (boolean/ordinal/numerical rubric) must never end up with
// stale rows for the previous type.
test("saveQuestionImportPlanInDb keeps a single rubric definition when two imports race the same rubric type change", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Concurrency Question Import Project",
	);
	const fixture = await createBooleanQuestionFixture(db, project.rowId);

	function makeOrdinalImport(marks: Record<string, number>): ImportedQuestions {
		return [
			{
				id: fixture.questionId,
				label: "Boolean question",
				rubrics: [
					{ id: fixture.rubricId, type: "ordinal", label: "Correct", marks },
				],
			},
		];
	}

	const questionsToMarksAB = makeOrdinalImport({ good: 1, bad: 0 });
	const questionsToMarksXY = makeOrdinalImport({ yes: 2, no: 0 });

	// Both plans are built against the same pre-race snapshot (rubric still
	// boolean, no linked assessments), mirroring two graders importing the
	// same in-flight change before either write lands.
	const [contextAB, contextXY] = await Promise.all([
		loadQuestionImportContextFromDb(db, {
			questions: questionsToMarksAB,
			projectId: project.id,
		}),
		loadQuestionImportContextFromDb(db, {
			questions: questionsToMarksXY,
			projectId: project.id,
		}),
	]);

	const planAB = prepareQuestionImport({
		questions: questionsToMarksAB,
		context: contextAB,
	});
	const planXY = prepareQuestionImport({
		questions: questionsToMarksXY,
		context: contextXY,
	});

	await runForcedInterleaving(db, {
		first: (tx) =>
			saveQuestionImportPlanInDb(tx, { plan: planAB, projectId: project.id }),
		second: (tx) =>
			saveQuestionImportPlanInDb(tx, { plan: planXY, projectId: project.id }),
	});

	const rubricRows = await db
		.selectFrom("rubric")
		.select(["rowId", "type"])
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.rubricId)
		.execute();
	expect(rubricRows).toHaveLength(1);
	expect(rubricRows[0]?.type).toBe("ordinal");
	const rubricRowId = rubricRows[0]?.rowId;

	const [booleanRows, ordinalRubricRows] = await Promise.all([
		db
			.selectFrom("booleanRubric")
			.select("rubricId")
			.where("rubricId", "=", rubricRowId ?? -1)
			.execute(),
		db
			.selectFrom("ordinalRubric")
			.select("id")
			.where("rubricId", "=", rubricRowId ?? -1)
			.execute(),
	]);
	expect(booleanRows).toHaveLength(0);
	expect(ordinalRubricRows).toHaveLength(1);

	const ordinalValues = await db
		.selectFrom("ordinalRubricValue")
		.select("label")
		.where("ordinalRubricId", "=", ordinalRubricRows[0]?.id ?? -1)
		.execute();
	const labels = ordinalValues.map((value) => value.label).sort();

	expect([
		["bad", "good"],
		["no", "yes"],
	]).toContainEqual(labels);

	// Documents current behavior, not a committed policy: the writer that
	// commits last (the second writer, here) wins.
	expect(labels).toEqual(["no", "yes"]);
});
