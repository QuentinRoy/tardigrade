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

	const questionsModule = await import("./questions");

	vi.doUnmock("./kysely");

	return questionsModule;
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

test("deleteManagedQuestion reports impact and cascades linked assessments", async () => {
	await using db = await createTestDb();
	const { deleteManagedQuestion } = await loadQuestionsModuleWithDb(db);

	await using project = await createProject(db, "Managed Delete Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const result = await deleteManagedQuestion(fixture.questionId, project.id);
	expect(result).toEqual({ assessmentCount: 1 });

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
