import { type Kysely } from "kysely";
import { expect, test, vi } from "vitest";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanQuestionFixture,
	createOrdinalQuestionFixture,
	createQuestion,
	getQuestionPositions,
} from "#test/questions.ts";
import type { DB } from "./generated/db.ts";

vi.mock("server-only", () => ({}));

vi.mock("#questions/errors.ts", () => ({
	QuestionsValidationError: class QuestionsValidationError extends Error {
		details?: unknown;

		constructor(details?: unknown) {
			super("Questions validation failed");
			this.name = "QuestionsValidationError";
			this.details = details;
		}
	},
}));

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
	updateTag: vi.fn(),
}));

async function loadQuestionDefinitionMutationsWithDb(db: Kysely<DB>) {
	vi.resetModules();
	using _kyselyMock = vi.doMock("./kysely", () => ({ db }));

	return await import("./questionDefinitionMutations.ts");
}

test("saveQuestionDefinition renames question id while preserving linked assessments", async () => {
	await using db = await createTestDb();
	const { saveQuestionDefinition } =
		await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Save Rename Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	const renamedQuestionId = buildTestId("question-renamed");

	const result = await saveQuestionDefinition(
		{
			originalId: fixture.questionId,
			id: renamedQuestionId,
			label: "Renamed question",
			rubrics: [
				{
					previousId: fixture.rubricId,
					id: fixture.rubricId,
					type: "boolean",
					label: "Correct",
					marks: 2,
					falseMarks: 0,
				},
			],
		},
		project.id,
	);

	expect(result).toEqual({ id: renamedQuestionId });

	const questionRow = await db
		.selectFrom("question")
		.select(["id", "rowId"])
		.where("projectId", "=", project.rowId)
		.where("id", "=", renamedQuestionId)
		.executeTakeFirstOrThrow();

	expect(questionRow.rowId).toBe(fixture.questionRowId);

	const assessment = await db
		.selectFrom("assessment")
		.select(["id", "questionId"])
		.where("id", "=", fixture.assessmentId)
		.executeTakeFirstOrThrow();

	expect(assessment.questionId).toBe(fixture.questionRowId);
});

test("saveQuestionDefinition replaces rubric subtype data when rubric type changes", async () => {
	await using db = await createTestDb();
	const { saveQuestionDefinition } =
		await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Save Type Change Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const replacedRubricId = buildTestId("rubric-numerical");

	await saveQuestionDefinition(
		{
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "Type-changed question",
			rubrics: [
				{
					previousId: fixture.rubricId,
					id: replacedRubricId,
					type: "numerical",
					label: "Score",
					minScore: 0,
					maxScore: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
				},
			],
		},
		project.id,
	);

	const oldRubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.rubricId)
		.execute();

	expect(oldRubric).toHaveLength(0);

	const newRubric = await db
		.selectFrom("rubric")
		.select(["rowId", "type"])
		.where("projectId", "=", project.rowId)
		.where("id", "=", replacedRubricId)
		.executeTakeFirstOrThrow();

	expect(newRubric.type).toBe("numerical");

	const booleanSubtypeRows = await db
		.selectFrom("booleanRubric")
		.select("id")
		.where("rubricId", "=", fixture.rubricRowId)
		.execute();

	const numericalSubtypeRows = await db
		.selectFrom("numericalRubric")
		.select(["rubricId", "minScore", "maxScore"])
		.where("rubricId", "=", newRubric.rowId)
		.execute();

	const linkedRubricAssessments = await db
		.selectFrom("rubricAssessment")
		.select("id")
		.where("assessmentId", "=", fixture.assessmentId)
		.execute();

	expect(booleanSubtypeRows).toHaveLength(0);
	expect(numericalSubtypeRows).toHaveLength(1);
	expect(linkedRubricAssessments).toHaveLength(0);
});

test("saveQuestionDefinition removes stale rubrics that are no longer referenced", async () => {
	await using db = await createTestDb();
	const { saveQuestionDefinition } =
		await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Save Stale Rubric Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const staleRubricId = buildTestId("rubric-stale");

	await saveQuestionDefinition(
		{
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "With stale rubric",
			rubrics: [
				{
					previousId: fixture.rubricId,
					id: fixture.rubricId,
					type: "boolean",
					label: "Primary",
					marks: 2,
					falseMarks: 0,
				},
				{
					id: staleRubricId,
					type: "boolean",
					label: "Temporary",
					marks: 1,
					falseMarks: 0,
				},
			],
		},
		project.id,
	);

	await saveQuestionDefinition(
		{
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "Stale removed",
			rubrics: [
				{
					previousId: fixture.rubricId,
					id: fixture.rubricId,
					type: "boolean",
					label: "Primary",
					marks: 2,
					falseMarks: 0,
				},
			],
		},
		project.id,
	);

	const staleRubricRows = await db
		.selectFrom("rubric")
		.select("id")
		.where("projectId", "=", project.rowId)
		.where("id", "=", staleRubricId)
		.execute();

	const remainingRubrics = await db
		.selectFrom("rubric")
		.select("id")
		.where("projectId", "=", project.rowId)
		.where("questionId", "=", fixture.questionRowId)
		.execute();

	expect(staleRubricRows).toHaveLength(0);
	expect(remainingRubrics.map((rubric) => rubric.id)).toEqual([
		fixture.rubricId,
	]);
});

test("saveQuestionDefinition replaces ordinal rubric values using the provided label set", async () => {
	await using db = await createTestDb();
	const { saveQuestionDefinition } =
		await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Save Ordinal Values Project");
	const fixture = await createOrdinalQuestionFixture(db, project.rowId);

	await saveQuestionDefinition(
		{
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "Ordinal updated",
			rubrics: [
				{
					previousId: fixture.rubricId,
					id: fixture.rubricId,
					type: "ordinal",
					label: "Ordinal",
					marks: { B: 2.5, C: 1 },
				},
			],
		},
		project.id,
	);

	const rubricRow = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.rubricId)
		.executeTakeFirstOrThrow();

	const ordinalRubric = await db
		.selectFrom("ordinalRubric")
		.select("id")
		.where("rubricId", "=", rubricRow.rowId)
		.executeTakeFirstOrThrow();

	const values = await db
		.selectFrom("ordinalRubricValue")
		.select(["label", "marks"])
		.where("ordinalRubricId", "=", ordinalRubric.id)
		.orderBy("label", "asc")
		.execute();

	const normalizedValues = values.map((value) => ({
		label: value.label,
		marks: Number(value.marks),
	}));

	expect(normalizedValues).toEqual([
		{ label: "B", marks: 2.5 },
		{ label: "C", marks: 1 },
	]);
});

test("deleteQuestionDefinition reports deletion and cascades linked assessments", async () => {
	await using db = await createTestDb();
	const { deleteQuestionDefinition } =
		await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Delete Cascade Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const result = await deleteQuestionDefinition(fixture.questionId, project.id);
	expect(result).toEqual({ deleted: true });

	const questionRows = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.questionId)
		.execute();

	const assessmentRows = await db
		.selectFrom("assessment")
		.select("id")
		.where("id", "=", fixture.assessmentId)
		.execute();

	expect(questionRows).toHaveLength(0);
	expect(assessmentRows).toHaveLength(0);
});

test("deleteQuestionDefinition returns deleted false when no question matches in project", async () => {
	await using db = await createTestDb();
	const { deleteQuestionDefinition } =
		await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Delete Missing Project");
	const missingId = buildTestId("question-missing");

	const result = await deleteQuestionDefinition(missingId, project.id);

	expect(result).toEqual({ deleted: false });
});

test("deleteQuestionDefinition deletes a question that has no assessments", async () => {
	await using db = await createTestDb();
	const { deleteQuestionDefinition } =
		await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Delete Standalone Project");
	const question = await createQuestion(db, project.rowId, 0);

	const result = await deleteQuestionDefinition(question.id, project.id);
	expect(result).toEqual({ deleted: true });

	const questionRows = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", question.id)
		.execute();

	expect(questionRows).toHaveLength(0);
});

test("reorderQuestions updates positions for the provided questions", async () => {
	await using db = await createTestDb();
	const { reorderQuestions } = await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Reorder Project");
	const first = await createQuestion(db, project.rowId, 0);
	const second = await createQuestion(db, project.rowId, 1);
	const third = await createQuestion(db, project.rowId, 2);

	await reorderQuestions(
		[
			{ id: third.id, position: 0 },
			{ id: first.id, position: 1 },
			{ id: second.id, position: 2 },
		],
		project.id,
	);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [third.id]: 0, [first.id]: 1, [second.id]: 2 });
});

test("reorderQuestions leaves questions outside the update list untouched", async () => {
	await using db = await createTestDb();
	const { reorderQuestions } = await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Reorder Partial Project");
	const first = await createQuestion(db, project.rowId, 0);
	const second = await createQuestion(db, project.rowId, 1);
	const untouched = await createQuestion(db, project.rowId, 2);

	await reorderQuestions(
		[
			{ id: first.id, position: 1 },
			{ id: second.id, position: 0 },
		],
		project.id,
	);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({
		[first.id]: 1,
		[second.id]: 0,
		[untouched.id]: 2,
	});
});

test("reorderQuestions only affects questions in the given project", async () => {
	await using db = await createTestDb();
	const { reorderQuestions } = await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Reorder Scoped Project");
	await using otherProject = await createProject(db, "Reorder Other Project");

	const question = await createQuestion(db, project.rowId, 0);
	const otherQuestion = await createQuestion(db, otherProject.rowId, 0);

	await reorderQuestions([{ id: question.id, position: 5 }], project.id);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [question.id]: 5 });

	const otherPositions = await getQuestionPositions(db, otherProject.rowId);
	expect(otherPositions).toEqual({ [otherQuestion.id]: 0 });
});

test("reorderQuestions does nothing when given no updates", async () => {
	await using db = await createTestDb();
	const { reorderQuestions } = await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Reorder Empty Project");
	const question = await createQuestion(db, project.rowId, 0);

	await reorderQuestions([], project.id);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [question.id]: 0 });
});

test("reorderQuestions throws and changes nothing when an id is not found", async () => {
	await using db = await createTestDb();
	const { reorderQuestions } = await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Reorder Missing Project");
	const existing = await createQuestion(db, project.rowId, 0);
	const missingId = buildTestId("question-missing");

	await expect(
		reorderQuestions(
			[
				{ id: existing.id, position: 1 },
				{ id: missingId, position: 0 },
			],
			project.id,
		),
	).rejects.toThrow(missingId);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [existing.id]: 0 });
});

test("reorderQuestions throws when the same id is provided more than once", async () => {
	await using db = await createTestDb();
	const { reorderQuestions } = await loadQuestionDefinitionMutationsWithDb(db);

	await using project = await createProject(db, "Reorder Duplicate Project");
	const question = await createQuestion(db, project.rowId, 0);

	await expect(
		reorderQuestions(
			[
				{ id: question.id, position: 1 },
				{ id: question.id, position: 2 },
			],
			project.id,
		),
	).rejects.toThrow(question.id);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [question.id]: 0 });
});
