import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import { buildTestId } from "./dbIntegration.ts";

export type AssessedBooleanFixture = BooleanQuestionFixture & {
	assessmentId: number;
};

export type BooleanQuestionFixture = {
	questionId: string;
	questionRowId: number;
	rubricId: string;
	rubricRowId: number;
};

// Creates a question carrying a single boolean rubric, without any submission
// or assessment.
export async function createBooleanQuestionFixture(
	db: Kysely<DB>,
	projectId: number,
	position = 0,
): Promise<BooleanQuestionFixture> {
	const questionId = buildTestId("question");
	const rubricId = buildTestId("rubric-boolean");

	const question = await db
		.insertInto("question")
		.values({ projectId, id: questionId, label: "Boolean question", position })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const rubric = await db
		.insertInto("rubric")
		.values({
			projectId,
			id: rubricId,
			questionId: question.rowId,
			type: "boolean",
			position: 0,
			label: "Correct",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: rubric.rowId, marks: 2, falseMarks: 0 })
		.execute();

	return {
		questionId,
		questionRowId: question.rowId,
		rubricId,
		rubricRowId: rubric.rowId,
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

	const rubricAssessment = await db
		.insertInto("rubricAssessment")
		.values({
			assessmentId: assessment.id,
			rubricId: question.rubricRowId,
			type: "boolean",
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubricAssessment")
		.values({ rubricAssessmentId: rubricAssessment.id, passed: true })
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
): Promise<{ questionId: string; rubricId: string }> {
	const questionId = buildTestId("question-ordinal");
	const rubricId = buildTestId("rubric-ordinal");

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

	const rubric = await db
		.insertInto("rubric")
		.values({
			projectId,
			id: rubricId,
			questionId: question.rowId,
			type: "ordinal",
			position: 0,
			label: "Ordinal",
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
			{ ordinalRubricId: ordinalRubric.id, label: "A", marks: 4 },
			{ ordinalRubricId: ordinalRubric.id, label: "B", marks: 2 },
		])
		.execute();

	return { questionId, rubricId };
}
