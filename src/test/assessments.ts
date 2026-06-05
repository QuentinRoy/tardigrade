import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import { buildTestId } from "./dbIntegration.ts";

export type AssessmentFixture = {
	projectId: string;
	questionId: string;
	studentId: string;
	submissionId: string;
	rubricIds: { boolean: string; ordinal: string; numerical: string };
};

export type AssessmentFixtureOptions = {
	questionId?: string;
	rubricIds?: { boolean: string; ordinal: string; numerical: string };
};

// Creates a submission with a question carrying one rubric of each type, ready for
// assessment round-trips. Exposes the Project ID (public identifier); the Project
// Row ID stays internal to the fixture plumbing. Cleanup is handled by disposing
// the owning project (cascade), so no separate teardown helper is needed.
export async function createAssessmentFixture(
	db: Kysely<DB>,
	projectId: string,
	options?: AssessmentFixtureOptions,
): Promise<AssessmentFixture> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();

	const projectRowId = project.rowId;

	const questionId = options?.questionId ?? buildTestId("q");
	const studentId = buildTestId("student");
	const booleanRubricId =
		options?.rubricIds?.boolean ?? buildTestId("rubric-boolean");
	const ordinalRubricId =
		options?.rubricIds?.ordinal ?? buildTestId("rubric-ordinal");
	const numericalRubricId =
		options?.rubricIds?.numerical ?? buildTestId("rubric-numerical");

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: studentId,
			lastName: "Integration",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select(["rowId", "id"])
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

	await db
		.insertInto("question")
		.values({
			projectId: projectRowId,
			id: questionId,
			label: "Integration question",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select(["id", "rowId"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	const insertedRubrics = await db
		.insertInto("rubric")
		.values([
			{
				id: booleanRubricId,
				projectId: projectRowId,
				questionId: question.rowId,
				type: "boolean",
				position: 0,
				label: "Boolean rubric",
			},
			{
				id: ordinalRubricId,
				projectId: projectRowId,
				questionId: question.rowId,
				type: "ordinal",
				position: 1,
				label: "Ordinal rubric",
			},
			{
				id: numericalRubricId,
				projectId: projectRowId,
				questionId: question.rowId,
				type: "numerical",
				position: 2,
				label: "Numerical rubric",
			},
		])
		.returning(["id", "rowId"])
		.execute();

	const rubricRowIdById = new Map(
		insertedRubrics.map((rubric) => [rubric.id, rubric.rowId]),
	);

	const booleanRubricRowId = rubricRowIdById.get(booleanRubricId);
	const ordinalRubricRowId = rubricRowIdById.get(ordinalRubricId);
	const numericalRubricRowId = rubricRowIdById.get(numericalRubricId);

	if (
		booleanRubricRowId == null ||
		ordinalRubricRowId == null ||
		numericalRubricRowId == null
	) {
		throw new Error("Expected inserted rubrics to be returned with row ids.");
	}

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: booleanRubricRowId, marks: 2 })
		.execute();

	const ordinalRubric = await db
		.insertInto("ordinalRubric")
		.values({ rubricId: ordinalRubricRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("ordinalRubricValue")
		.values([
			{ ordinalRubricId: ordinalRubric.id, label: "A", marks: 3 },
			{ ordinalRubricId: ordinalRubric.id, label: "B", marks: 1 },
		])
		.execute();

	await db
		.insertInto("numericalRubric")
		.values({
			rubricId: numericalRubricRowId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return {
		projectId,
		questionId,
		studentId,
		submissionId: String(submission.id),
		rubricIds: {
			boolean: booleanRubricId,
			ordinal: ordinalRubricId,
			numerical: numericalRubricId,
		},
	};
}
