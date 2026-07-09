import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import {
	assessmentAggregateCacheTag,
	assessmentImportCacheTag,
	assessmentProgressForQuestionCacheTag,
	questionListCacheTag,
} from "#db/cacheTags.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanQuestionFixture,
	createOrdinalQuestionFixture,
	createQuestion,
	getQuestionPositions,
} from "#test/questions.ts";
import {
	deleteQuestionDefinition,
	deleteQuestionDefinitionInDb,
	reorderQuestions,
	reorderQuestionsInDb,
	saveQuestionDefinition,
	saveQuestionDefinitionInDb,
} from "./questionDefinitionMutations.ts";

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

test("saveQuestionDefinitionInDb persists inside a caller transaction and rolls back with it", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Rollback Project");
	const questionId = buildTestId("question-primitive");

	await expect(
		db.transaction().execute(async (tx) => {
			await saveQuestionDefinitionInDb(tx, {
				input: {
					id: questionId,
					label: "Inside transaction",
					criteria: [
						{
							id: buildTestId("criterion"),
							kind: "check",
							label: "Correct",
							marks: 2,
							falseMarks: 0,
						},
					],
				},
				projectId: project.id,
			});

			const insideTransaction = await tx
				.selectFrom("question")
				.select("id")
				.where("id", "=", questionId)
				.execute();
			expect(insideTransaction).toHaveLength(1);

			throw new Error("force rollback");
		}),
	).rejects.toThrow("force rollback");

	const afterRollback = await db
		.selectFrom("question")
		.select("id")
		.where("id", "=", questionId)
		.execute();
	expect(afterRollback).toHaveLength(0);
});

test("saveQuestionDefinitionInDb renames question id while preserving linked assessments", async () => {
	await using db = await createTestDb();
	const { updateTag } = await import("next/cache");
	await using project = await createProject(db, "Save Rename Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	const renamedQuestionId = buildTestId("question-renamed");

	const result = await saveQuestionDefinitionInDb(db, {
		input: {
			originalId: fixture.questionId,
			id: renamedQuestionId,
			label: "Renamed question",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "check",
					label: "Correct",
					marks: 2,
					falseMarks: 0,
				},
			],
		},
		projectId: project.id,
	});

	expect(result.id).toBe(renamedQuestionId);
	// A DB Primitive never invalidates cache — that is the wrapper's job.
	expect(updateTag).not.toHaveBeenCalled();

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

test("saveQuestionDefinitionInDb replaces criterion subtype data when criterion type changes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Type Change Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const replacedCriterionId = buildTestId("criterion-numerical");

	await saveQuestionDefinitionInDb(db, {
		input: {
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "Type-changed question",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: replacedCriterionId,
					kind: "number",
					label: "Score",
					minScore: 0,
					maxScore: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
				},
			],
		},
		projectId: project.id,
	});

	const oldCriterion = await db
		.selectFrom("criterion")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.execute();

	expect(oldCriterion).toHaveLength(0);

	const newCriterion = await db
		.selectFrom("criterion")
		.select(["rowId", "kind"])
		.where("projectId", "=", project.rowId)
		.where("id", "=", replacedCriterionId)
		.executeTakeFirstOrThrow();

	expect(newCriterion.kind).toBe("number");

	const booleanSubtypeRows = await db
		.selectFrom("checkCriterion")
		.select("id")
		.where("criterionId", "=", fixture.criterionRowId)
		.execute();

	const numericalSubtypeRows = await db
		.selectFrom("numberCriterion")
		.select(["criterionId", "minScore", "maxScore"])
		.where("criterionId", "=", newCriterion.rowId)
		.execute();

	const linkedCriterionAssessments = await db
		.selectFrom("criterionAssessment")
		.select("id")
		.where("assessmentId", "=", fixture.assessmentId)
		.execute();

	expect(booleanSubtypeRows).toHaveLength(0);
	expect(numericalSubtypeRows).toHaveLength(1);
	expect(linkedCriterionAssessments).toHaveLength(0);
});

test("saveQuestionDefinitionInDb removes stale criteria that are no longer referenced", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Stale Criterion Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const staleCriterionId = buildTestId("criterion-stale");

	await saveQuestionDefinitionInDb(db, {
		input: {
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "With stale criterion",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "check",
					label: "Primary",
					marks: 2,
					falseMarks: 0,
				},
				{
					id: staleCriterionId,
					kind: "check",
					label: "Temporary",
					marks: 1,
					falseMarks: 0,
				},
			],
		},
		projectId: project.id,
	});

	await saveQuestionDefinitionInDb(db, {
		input: {
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "Stale removed",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "check",
					label: "Primary",
					marks: 2,
					falseMarks: 0,
				},
			],
		},
		projectId: project.id,
	});

	const staleCriterionRows = await db
		.selectFrom("criterion")
		.select("id")
		.where("projectId", "=", project.rowId)
		.where("id", "=", staleCriterionId)
		.execute();

	const remainingCriteria = await db
		.selectFrom("criterion")
		.select("id")
		.where("projectId", "=", project.rowId)
		.where("questionId", "=", fixture.questionRowId)
		.execute();

	expect(staleCriterionRows).toHaveLength(0);
	expect(remainingCriteria.map((criterion) => criterion.id)).toEqual([
		fixture.criterionId,
	]);
});

test("saveQuestionDefinitionInDb replaces ordinal criterion values using the provided label set", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Ordinal Values Project");
	const fixture = await createOrdinalQuestionFixture(db, project.rowId);

	await saveQuestionDefinitionInDb(db, {
		input: {
			originalId: fixture.questionId,
			id: fixture.questionId,
			label: "Ordinal updated",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "options",
					label: "Ordinal",
					marks: { B: 2.5, C: 1 },
				},
			],
		},
		projectId: project.id,
	});

	const criterionRow = await db
		.selectFrom("criterion")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	const optionsCriterion = await db
		.selectFrom("optionsCriterion")
		.select("id")
		.where("criterionId", "=", criterionRow.rowId)
		.executeTakeFirstOrThrow();

	const values = await db
		.selectFrom("optionsCriterionMark")
		.select(["label", "marks"])
		.where("optionsCriterionId", "=", optionsCriterion.id)
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

test("deleteQuestionDefinitionInDb reports deletion and cascades linked assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Cascade Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const result = await deleteQuestionDefinitionInDb(db, {
		questionId: fixture.questionId,
		projectId: project.id,
	});
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

test("deleteQuestionDefinitionInDb returns deleted false when no question matches in project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Missing Project");
	const missingId = buildTestId("question-missing");

	const result = await deleteQuestionDefinitionInDb(db, {
		questionId: missingId,
		projectId: project.id,
	});

	expect(result).toEqual({ deleted: false });
});

test("deleteQuestionDefinitionInDb deletes a question that has no assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Standalone Project");
	const question = await createQuestion(db, project.rowId, 0);

	const result = await deleteQuestionDefinitionInDb(db, {
		questionId: question.id,
		projectId: project.id,
	});
	expect(result).toEqual({ deleted: true });

	const questionRows = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", question.id)
		.execute();

	expect(questionRows).toHaveLength(0);
});

test("reorderQuestionsInDb updates positions for the provided questions", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Project");
	const first = await createQuestion(db, project.rowId, 0);
	const second = await createQuestion(db, project.rowId, 1);
	const third = await createQuestion(db, project.rowId, 2);

	await reorderQuestionsInDb(db, {
		updates: [
			{ id: third.id, position: 0 },
			{ id: first.id, position: 1 },
			{ id: second.id, position: 2 },
		],
		projectId: project.id,
	});

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [third.id]: 0, [first.id]: 1, [second.id]: 2 });
});

test("reorderQuestionsInDb leaves questions outside the update list untouched", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Partial Project");
	const first = await createQuestion(db, project.rowId, 0);
	const second = await createQuestion(db, project.rowId, 1);
	const untouched = await createQuestion(db, project.rowId, 2);

	await reorderQuestionsInDb(db, {
		updates: [
			{ id: first.id, position: 1 },
			{ id: second.id, position: 0 },
		],
		projectId: project.id,
	});

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({
		[first.id]: 1,
		[second.id]: 0,
		[untouched.id]: 2,
	});
});

test("reorderQuestionsInDb only affects questions in the given project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Scoped Project");
	await using otherProject = await createProject(db, "Reorder Other Project");

	const question = await createQuestion(db, project.rowId, 0);
	const otherQuestion = await createQuestion(db, otherProject.rowId, 0);

	await reorderQuestionsInDb(db, {
		updates: [{ id: question.id, position: 5 }],
		projectId: project.id,
	});

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [question.id]: 5 });

	const otherPositions = await getQuestionPositions(db, otherProject.rowId);
	expect(otherPositions).toEqual({ [otherQuestion.id]: 0 });
});

test("reorderQuestionsInDb does nothing when given no updates", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Empty Project");
	const question = await createQuestion(db, project.rowId, 0);

	await reorderQuestionsInDb(db, { updates: [], projectId: project.id });

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [question.id]: 0 });
});

test("reorderQuestionsInDb throws and changes nothing when an id is not found", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Missing Project");
	const existing = await createQuestion(db, project.rowId, 0);
	const missingId = buildTestId("question-missing");

	await expect(
		db.transaction().execute((tx) =>
			reorderQuestionsInDb(tx, {
				updates: [
					{ id: existing.id, position: 1 },
					{ id: missingId, position: 0 },
				],
				projectId: project.id,
			}),
		),
	).rejects.toThrow(missingId);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [existing.id]: 0 });
});

test("reorderQuestionsInDb throws when the same id is provided more than once", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Duplicate Project");
	const question = await createQuestion(db, project.rowId, 0);

	await expect(
		reorderQuestionsInDb(db, {
			updates: [
				{ id: question.id, position: 1 },
				{ id: question.id, position: 2 },
			],
			projectId: project.id,
		}),
	).rejects.toThrow(question.id);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [question.id]: 0 });
});

test("saveQuestionDefinition wrapper updates the question list read-your-writes and revalidates assessment tags after commit", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Cache Project");
	const questionId = buildTestId("question");

	await saveQuestionDefinition(
		{
			input: {
				id: questionId,
				label: "Cached question",
				criteria: [
					{
						id: buildTestId("criterion"),
						kind: "check",
						label: "Correct",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			projectId: project.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([questionListCacheTag()]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		assessmentAggregateCacheTag(),
		assessmentImportCacheTag(),
		assessmentProgressForQuestionCacheTag(questionId),
	]);
});

test("saveQuestionDefinition wrapper revalidates the previous question's progress when the id changes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Rename Cache Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	const renamedQuestionId = buildTestId("question-renamed");

	await saveQuestionDefinition(
		{
			input: {
				originalId: fixture.questionId,
				id: renamedQuestionId,
				label: "Renamed question",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: fixture.criterionId,
						kind: "check",
						label: "Correct",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			projectId: project.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([questionListCacheTag()]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		assessmentAggregateCacheTag(),
		assessmentImportCacheTag(),
		assessmentProgressForQuestionCacheTag(renamedQuestionId),
		assessmentProgressForQuestionCacheTag(fixture.questionId),
	]);
});

test("saveQuestionDefinition wrapper does not invalidate when persistence throws", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Cache Throw Project");

	await expect(
		saveQuestionDefinition(
			{ input: { id: "   ", criteria: [] }, projectId: project.id },
			{ db },
		),
	).rejects.toThrow();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("deleteQuestionDefinition wrapper updates the question list read-your-writes and revalidates assessment tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Cache Project");
	const question = await createQuestion(db, project.rowId, 0);

	await deleteQuestionDefinition(
		{ questionId: question.id, projectId: project.id },
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([questionListCacheTag()]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		assessmentAggregateCacheTag(),
		assessmentImportCacheTag(),
		assessmentProgressForQuestionCacheTag(question.id),
	]);
});

test("reorderQuestions wrapper updates the questions tag read-your-writes after commit", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Cache Project");
	const first = await createQuestion(db, project.rowId, 0);
	const second = await createQuestion(db, project.rowId, 1);

	await reorderQuestions(
		{
			updates: [
				{ id: first.id, position: 1 },
				{ id: second.id, position: 0 },
			],
			projectId: project.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([questionListCacheTag()]);
	expect(revalidateTag).not.toHaveBeenCalled();
});
