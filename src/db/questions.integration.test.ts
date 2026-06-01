import { type Kysely } from "kysely";
import { expect, test, vi } from "vitest";
import { buildTestId, createTestDb } from "../test/dbIntegration";
import { createProject } from "../test/projects";
import type { DB } from "./generated/db";

vi.mock("server-only", () => ({}));

vi.mock("@/questions/errors", () => ({
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

async function loadQuestionsModuleWithDb(db: Kysely<DB>) {
	vi.resetModules();
	vi.doMock("./kysely", () => ({ db }));

	const [read, managed, commands] = await Promise.all([
		import("./questionsRead"),
		import("./questionsManaged"),
		import("./questionsCommands"),
	]);

	vi.doUnmock("./kysely");

	return { ...read, ...managed, ...commands };
}

type AssessedBooleanFixture = {
	questionId: string;
	questionRowId: number;
	rubricId: string;
	rubricRowId: number;
	assessmentId: number;
};

async function createAssessedBooleanQuestionFixture(
	db: Kysely<DB>,
	projectId: number,
): Promise<AssessedBooleanFixture> {
	const questionId = buildTestId("question");
	const rubricId = buildTestId("rubric-boolean");
	const studentId = buildTestId("student");

	await db
		.insertInto("student")
		.values({
			projectId,
			id: studentId,
			firstName: "Managed",
			lastName: "Question",
		})
		.execute();

	const student = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", projectId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const submission = await db
		.insertInto("submission")
		.values({ projectId, type: "individual", studentId: student.rowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("question")
		.values({
			projectId,
			id: questionId,
			label: "Managed question",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", projectId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("rubric")
		.values({
			projectId,
			id: rubricId,
			questionId: question.rowId,
			type: "boolean",
			position: 0,
			label: "Correct",
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", projectId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: rubric.rowId, marks: 2, falseMarks: 0 })
		.execute();

	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId,
			submissionId: submission.id,
			questionId: question.rowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const rubricAssessment = await db
		.insertInto("rubricAssessment")
		.values({
			assessmentId: assessment.id,
			rubricId: rubric.rowId,
			type: "boolean",
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubricAssessment")
		.values({ rubricAssessmentId: rubricAssessment.id, passed: true })
		.execute();

	return {
		questionId,
		questionRowId: question.rowId,
		rubricId,
		rubricRowId: rubric.rowId,
		assessmentId: assessment.id,
	};
}

async function createQuestion(
	db: Kysely<DB>,
	projectId: number,
	position: number,
): Promise<{ id: string; rowId: number }> {
	const id = buildTestId("question");

	await db
		.insertInto("question")
		.values({ projectId, id, label: `Question ${position}`, position })
		.execute();

	const question = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", projectId)
		.where("id", "=", id)
		.executeTakeFirstOrThrow();

	return { id, rowId: question.rowId };
}

async function getQuestionPositions(
	db: Kysely<DB>,
	projectId: number,
): Promise<Record<string, number>> {
	const rows = await db
		.selectFrom("question")
		.select(["id", "position"])
		.where("projectId", "=", projectId)
		.execute();

	return Object.fromEntries(rows.map((row) => [row.id, row.position]));
}

async function createOrdinalQuestionFixture(
	db: Kysely<DB>,
	projectId: number,
): Promise<{ questionId: string; rubricId: string }> {
	const questionId = buildTestId("question-ordinal");
	const rubricId = buildTestId("rubric-ordinal");

	await db
		.insertInto("question")
		.values({
			projectId,
			id: questionId,
			label: "Ordinal question",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", projectId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("rubric")
		.values({
			projectId,
			id: rubricId,
			questionId: question.rowId,
			type: "ordinal",
			position: 0,
			label: "Ordinal",
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", projectId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const ordinalRubric = await db
		.insertInto("ordinalRubric")
		.values({ rubricId: rubric.rowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("ordinalRubricValue")
		.values([
			{ ordinalRubricId: ordinalRubric.id, label: "A", marks: 4 },
			{ ordinalRubricId: ordinalRubric.id, label: "B", marks: 2 },
		])
		.execute();

	return { questionId, rubricId };
}

test("saveManagedQuestion renames question id while preserving linked assessments", async () => {
	await using db = await createTestDb();
	const { saveManagedQuestion, getQuestionDeleteImpact } =
		await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Managed Rename Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	const renamedQuestionId = buildTestId("question-renamed");

	const result = await saveManagedQuestion(
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

	const impact = await getQuestionDeleteImpact(renamedQuestionId, project.id);
	expect(impact).toEqual({ assessmentCount: 1 });
});

test("saveManagedQuestion replaces rubric subtype data when rubric type changes", async () => {
	await using db = await createTestDb();
	const { saveManagedQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Managed Type Change Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const replacedRubricId = buildTestId("rubric-numerical");

	await saveManagedQuestion(
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

test("saveManagedQuestion removes stale rubrics that are no longer referenced", async () => {
	await using db = await createTestDb();
	const { saveManagedQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Managed Stale Rubric Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const staleRubricId = buildTestId("rubric-stale");

	await saveManagedQuestion(
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

	await saveManagedQuestion(
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

test("saveManagedQuestion replaces ordinal rubric values using the provided label set", async () => {
	await using db = await createTestDb();
	const { saveManagedQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(
		db,
		"Managed Ordinal Values Project",
	);
	const fixture = await createOrdinalQuestionFixture(db, project.rowId);

	await saveManagedQuestion(
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

test("deleteManagedQuestion reports deletion and cascades linked assessments", async () => {
	await using db = await createTestDb();
	const { deleteManagedQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Managed Delete Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const result = await deleteManagedQuestion(fixture.questionId, project.id);
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

test("deleteManagedQuestion returns deleted false when no question matches in project", async () => {
	await using db = await createTestDb();
	const { deleteManagedQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(
		db,
		"Managed Delete Missing Project",
	);
	const missingId = buildTestId("question-missing");

	const result = await deleteManagedQuestion(missingId, project.id);

	expect(result).toEqual({ deleted: false });
});

test("deleteManagedQuestion deletes a question that has no assessments", async () => {
	await using db = await createTestDb();
	const { deleteManagedQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(
		db,
		"Managed Delete Standalone Project",
	);
	const question = await createQuestion(db, project.rowId, 0);

	const result = await deleteManagedQuestion(question.id, project.id);
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
	const { reorderQuestions } = await loadQuestionsModuleWithDb(db);

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
	const { reorderQuestions } = await loadQuestionsModuleWithDb(db);

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
	const { reorderQuestions } = await loadQuestionsModuleWithDb(db);

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
	const { reorderQuestions } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Reorder Empty Project");
	const question = await createQuestion(db, project.rowId, 0);

	await reorderQuestions([], project.id);

	const positions = await getQuestionPositions(db, project.rowId);
	expect(positions).toEqual({ [question.id]: 0 });
});

test("reorderQuestions throws and changes nothing when an id is not found", async () => {
	await using db = await createTestDb();
	const { reorderQuestions } = await loadQuestionsModuleWithDb(db);

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
	const { reorderQuestions } = await loadQuestionsModuleWithDb(db);

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

test("loadQuestions returns scoped grid and loadQuestion returns a single question", async () => {
	await using db = await createTestDb();
	const { loadQuestions, loadQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Read Seam Project");
	await using otherProject = await createProject(db, "Read Seam Other Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	await createAssessedBooleanQuestionFixture(db, otherProject.rowId);

	const grid = await loadQuestions(project.id);

	expect(Object.keys(grid)).toEqual([fixture.questionId]);
	expect(grid[fixture.questionId]).toEqual({
		label: "Managed question",
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

test("loadManagedQuestions returns scoped summaries with assessment and rubric counts", async () => {
	await using db = await createTestDb();
	const { loadManagedQuestions } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Managed Read Project");
	await using otherProject = await createProject(
		db,
		"Managed Read Other Project",
	);
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	await createAssessedBooleanQuestionFixture(db, otherProject.rowId);

	const managed = await loadManagedQuestions(project.id);

	expect(managed).toEqual([
		{
			id: fixture.questionId,
			label: "Managed question",
			position: 0,
			assessmentCount: 1,
			rubricCount: 1,
			question: {
				label: "Managed question",
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
			},
		},
	]);
});

test("loadManagedQuestions returns zero assessment count for unassessed questions", async () => {
	await using db = await createTestDb();
	const { loadManagedQuestions } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(
		db,
		"Managed Read Unassessed Project",
	);
	const question = await createQuestion(db, project.rowId, 0);

	const managed = await loadManagedQuestions(project.id);

	expect(managed).toEqual([
		{
			id: question.id,
			label: "Question 0",
			position: 0,
			assessmentCount: 0,
			rubricCount: 0,
			question: { label: "Question 0", rubrics: [] },
		},
	]);
});
