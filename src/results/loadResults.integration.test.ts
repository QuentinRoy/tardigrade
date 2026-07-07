import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { loadCriterionAssessmentRecordsFromDb } from "./loadResults.ts";

async function createSubmission(
	db: Kysely<DB>,
	projectRowId: number,
): Promise<number> {
	const studentId = buildTestId("student");

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: studentId,
			lastName: "Overview",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const submission = await db
		.insertInto("submission")
		.values({
			projectId: projectRowId,
			type: "individual",
			studentId: studentRow.rowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	return submission.id;
}

async function createQuestion(
	db: Kysely<DB>,
	projectRowId: number,
	questionId: string,
): Promise<number> {
	await db
		.insertInto("question")
		.values({
			projectId: projectRowId,
			id: questionId,
			label: "Overview Q",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	return question.rowId;
}

async function createBooleanRubric(
	db: Kysely<DB>,
	{
		projectRowId,
		questionRowId,
		rubricId,
	}: { projectRowId: number; questionRowId: number; rubricId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("rubric")
		.values({
			id: rubricId,
			projectId: projectRowId,
			questionId: questionRowId,
			type: "boolean",
			position: 0,
			label: "Boolean Rubric",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: rubric.rowId, marks: 1, falseMarks: 0 })
		.execute();

	return rubric.rowId;
}

async function createOrdinalRubric(
	db: Kysely<DB>,
	{
		projectRowId,
		questionRowId,
		rubricId,
	}: { projectRowId: number; questionRowId: number; rubricId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("rubric")
		.values({
			id: rubricId,
			projectId: projectRowId,
			questionId: questionRowId,
			type: "ordinal",
			position: 1,
			label: "Ordinal Rubric",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const ordinalRubric = await db
		.insertInto("ordinalRubric")
		.values({ rubricId: rubric.rowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("ordinalRubricValue")
		.values([
			{ ordinalRubricId: ordinalRubric.id, label: "low", marks: 1 },
			{ ordinalRubricId: ordinalRubric.id, label: "high", marks: 3 },
		])
		.execute();

	return rubric.rowId;
}

async function createNumericalRubric(
	db: Kysely<DB>,
	{
		projectRowId,
		questionRowId,
		rubricId,
	}: { projectRowId: number; questionRowId: number; rubricId: string },
): Promise<number> {
	const rubric = await db
		.insertInto("rubric")
		.values({
			id: rubricId,
			projectId: projectRowId,
			questionId: questionRowId,
			type: "numerical",
			position: 2,
			label: "Numerical Rubric",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numericalRubric")
		.values({
			rubricId: rubric.rowId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return rubric.rowId;
}

// `Assessment` is unique per (submissionId, questionId): multiple rubrics on the
// same question share one assessment row, each with its own `rubricAssessment`.
async function createAssessment(
	db: Kysely<DB>,
	{
		projectRowId,
		submissionId,
		questionRowId,
	}: { projectRowId: number; submissionId: number; questionRowId: number },
): Promise<number> {
	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId: projectRowId,
			submissionId,
			questionId: questionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	return assessment.id;
}

async function addBooleanAssessment(
	db: Kysely<DB>,
	{
		assessmentId,
		rubricRowId,
		passed,
	}: { assessmentId: number; rubricRowId: number; passed: boolean },
): Promise<void> {
	const rubricAssessment = await db
		.insertInto("rubricAssessment")
		.values({ assessmentId, rubricId: rubricRowId, type: "boolean" })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubricAssessment")
		.values({ rubricAssessmentId: rubricAssessment.id, passed })
		.execute();
}

async function addOrdinalAssessment(
	db: Kysely<DB>,
	{
		assessmentId,
		rubricRowId,
		selectedLabel,
	}: { assessmentId: number; rubricRowId: number; selectedLabel: string },
): Promise<void> {
	const rubricAssessment = await db
		.insertInto("rubricAssessment")
		.values({ assessmentId, rubricId: rubricRowId, type: "ordinal" })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("ordinalRubricAssessment")
		.values({ rubricAssessmentId: rubricAssessment.id, selectedLabel })
		.execute();
}

async function addNumericalAssessment(
	db: Kysely<DB>,
	{
		assessmentId,
		rubricRowId,
		score,
	}: { assessmentId: number; rubricRowId: number; score: number },
): Promise<void> {
	const rubricAssessment = await db
		.insertInto("rubricAssessment")
		.values({ assessmentId, rubricId: rubricRowId, type: "numerical" })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numericalRubricAssessment")
		.values({ rubricAssessmentId: rubricAssessment.id, score })
		.execute();
}

test("loadCriterionAssessmentRecordsFromDb maps the per-type value column for boolean, ordinal and numerical assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Overview Types");

	const submissionId = await createSubmission(db, project.rowId);
	const questionRowId = await createQuestion(
		db,
		project.rowId,
		buildTestId("question"),
	);

	const booleanRubricId = buildTestId("rubric-boolean");
	const ordinalRubricId = buildTestId("rubric-ordinal");
	const numericalRubricId = buildTestId("rubric-numerical");

	const booleanRubricRowId = await createBooleanRubric(db, {
		projectRowId: project.rowId,
		questionRowId,
		rubricId: booleanRubricId,
	});
	const ordinalRubricRowId = await createOrdinalRubric(db, {
		projectRowId: project.rowId,
		questionRowId,
		rubricId: ordinalRubricId,
	});
	const numericalRubricRowId = await createNumericalRubric(db, {
		projectRowId: project.rowId,
		questionRowId,
		rubricId: numericalRubricId,
	});

	const assessmentId = await createAssessment(db, {
		projectRowId: project.rowId,
		submissionId,
		questionRowId,
	});
	await addBooleanAssessment(db, {
		assessmentId,
		rubricRowId: booleanRubricRowId,
		passed: true,
	});
	await addOrdinalAssessment(db, {
		assessmentId,
		rubricRowId: ordinalRubricRowId,
		selectedLabel: "high",
	});
	await addNumericalAssessment(db, {
		assessmentId,
		rubricRowId: numericalRubricRowId,
		score: 7,
	});

	const records = await loadCriterionAssessmentRecordsFromDb(db, {
		projectId: project.id,
	});

	expect(records).toHaveLength(3);

	const byCriterionId = new Map(
		records.map((record) => [record.criterionId, record]),
	);

	expect(byCriterionId.get(booleanRubricId)).toEqual({
		gradeTargetId: submissionId,
		criterionId: booleanRubricId,
		type: "boolean",
		passed: true,
		selectedLabel: null,
		score: null,
	});
	expect(byCriterionId.get(ordinalRubricId)).toEqual({
		gradeTargetId: submissionId,
		criterionId: ordinalRubricId,
		type: "ordinal",
		passed: null,
		selectedLabel: "high",
		score: null,
	});
	expect(byCriterionId.get(numericalRubricId)).toEqual({
		gradeTargetId: submissionId,
		criterionId: numericalRubricId,
		type: "numerical",
		passed: null,
		selectedLabel: null,
		score: 7,
	});
});

test("loadCriterionAssessmentRecordsFromDb excludes assessment records from other projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Rubric Overview Isolation A");
	await using projectB = await createProject(db, "Rubric Overview Isolation B");

	const submissionA = await createSubmission(db, projectA.rowId);
	const submissionB = await createSubmission(db, projectB.rowId);

	const questionRowIdA = await createQuestion(
		db,
		projectA.rowId,
		buildTestId("question-a"),
	);
	const questionRowIdB = await createQuestion(
		db,
		projectB.rowId,
		buildTestId("question-b"),
	);

	const rubricIdA = buildTestId("rubric-a");
	const rubricIdB = buildTestId("rubric-b");

	const rubricRowIdA = await createBooleanRubric(db, {
		projectRowId: projectA.rowId,
		questionRowId: questionRowIdA,
		rubricId: rubricIdA,
	});
	const rubricRowIdB = await createBooleanRubric(db, {
		projectRowId: projectB.rowId,
		questionRowId: questionRowIdB,
		rubricId: rubricIdB,
	});

	const assessmentIdA = await createAssessment(db, {
		projectRowId: projectA.rowId,
		submissionId: submissionA,
		questionRowId: questionRowIdA,
	});
	const assessmentIdB = await createAssessment(db, {
		projectRowId: projectB.rowId,
		submissionId: submissionB,
		questionRowId: questionRowIdB,
	});
	await addBooleanAssessment(db, {
		assessmentId: assessmentIdA,
		rubricRowId: rubricRowIdA,
		passed: true,
	});
	await addBooleanAssessment(db, {
		assessmentId: assessmentIdB,
		rubricRowId: rubricRowIdB,
		passed: false,
	});

	const recordsA = await loadCriterionAssessmentRecordsFromDb(db, {
		projectId: projectA.id,
	});
	const recordsB = await loadCriterionAssessmentRecordsFromDb(db, {
		projectId: projectB.id,
	});

	expect(recordsA).toEqual([
		{
			gradeTargetId: submissionA,
			criterionId: rubricIdA,
			type: "boolean",
			passed: true,
			selectedLabel: null,
			score: null,
		},
	]);
	expect(recordsB).toEqual([
		{
			gradeTargetId: submissionB,
			criterionId: rubricIdB,
			type: "boolean",
			passed: false,
			selectedLabel: null,
			score: null,
		},
	]);
});
