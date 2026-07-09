import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import { buildTestId } from "./dbIntegration.ts";

export type AssessedBooleanFixture = BooleanQuestionFixture & {
	assessmentId: number;
};

export type BooleanQuestionFixture = {
	questionId: string;
	questionRowId: number;
	criterionId: string;
	criterionRowId: number;
};

// Creates a question carrying a single boolean criterion, without any submission
// or assessment.
export async function createBooleanQuestionFixture(
	db: Kysely<DB>,
	projectId: number,
	position = 0,
): Promise<BooleanQuestionFixture> {
	const questionId = buildTestId("question");
	const criterionId = buildTestId("criterion-boolean");

	const question = await db
		.insertInto("question")
		.values({ projectId, id: questionId, label: "Boolean question", position })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			projectId,
			id: criterionId,
			questionId: question.rowId,
			kind: "check",
			position: 0,
			label: "Correct",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: criterion.rowId, marks: 2, falseMarks: 0 })
		.execute();

	return {
		questionId,
		questionRowId: question.rowId,
		criterionId,
		criterionRowId: criterion.rowId,
	};
}

export async function createAssessedBooleanQuestionFixture(
	db: Kysely<DB>,
	projectId: number,
): Promise<AssessedBooleanFixture> {
	const question = await createBooleanQuestionFixture(db, projectId);
	const studentId = buildTestId("student");

	const student = await db
		.insertInto("student")
		.values({
			projectId,
			id: studentId,
			firstName: "Sample",
			lastName: "Student",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const submission = await db
		.insertInto("submission")
		.values({ projectId, type: "individual", studentId: student.rowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId,
			submissionId: submission.id,
			questionId: question.questionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const criterionAssessment = await db
		.insertInto("criterionAssessment")
		.values({
			assessmentId: assessment.id,
			criterionId: question.criterionRowId,
			kind: "check",
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionAssessment")
		.values({ criterionAssessmentId: criterionAssessment.id, passed: true })
		.execute();

	return { ...question, assessmentId: assessment.id };
}

export async function createQuestion(
	db: Kysely<DB>,
	projectId: number,
	position: number,
): Promise<{ id: string; rowId: number }> {
	const id = buildTestId("question");

	const question = await db
		.insertInto("question")
		.values({ projectId, id, label: `Question ${position}`, position })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	return { id, rowId: question.rowId };
}

export async function getQuestionPositions(
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

export async function createOrdinalQuestionFixture(
	db: Kysely<DB>,
	projectId: number,
): Promise<{ questionId: string; criterionId: string }> {
	const questionId = buildTestId("question-ordinal");
	const criterionId = buildTestId("criterion-ordinal");

	const question = await db
		.insertInto("question")
		.values({
			projectId,
			id: questionId,
			label: "Ordinal question",
			position: 0,
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			projectId,
			id: criterionId,
			questionId: question.rowId,
			kind: "options",
			position: 0,
			label: "Ordinal",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const optionsCriterion = await db
		.insertInto("optionsCriterion")
		.values({ criterionId: criterion.rowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterionMark")
		.values([
			{ optionsCriterionId: optionsCriterion.id, label: "A", marks: 4 },
			{ optionsCriterionId: optionsCriterion.id, label: "B", marks: 2 },
		])
		.execute();

	return { questionId, criterionId };
}
