import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import { buildTestId } from "./dbIntegration.ts";

export type AssessmentFixture = {
	projectId: string;
	rubricId: string;
	studentId: string;
	submissionId: string;
	criterionIds: { boolean: string; ordinal: string; numerical: string };
};

export type AssessmentFixtureOptions = {
	rubricId?: string;
	criterionIds?: { boolean: string; ordinal: string; numerical: string };
};

// Creates a submission with a rubric carrying one criterion of each type, ready for
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

	const rubricId = options?.rubricId ?? buildTestId("q");
	const studentId = buildTestId("student");
	const checkCriterionId =
		options?.criterionIds?.boolean ?? buildTestId("criterion-boolean");
	const optionsCriterionId =
		options?.criterionIds?.ordinal ?? buildTestId("criterion-ordinal");
	const numberCriterionId =
		options?.criterionIds?.numerical ?? buildTestId("criterion-numerical");

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
		.insertInto("rubric")
		.values({
			projectId: projectRowId,
			id: rubricId,
			label: "Integration rubric",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select(["id", "rowId"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const insertedCriteria = await db
		.insertInto("criterion")
		.values([
			{
				id: checkCriterionId,
				projectId: projectRowId,
				rubricId: rubric.rowId,
				kind: "check",
				position: 0,
				label: "Boolean criterion",
			},
			{
				id: optionsCriterionId,
				projectId: projectRowId,
				rubricId: rubric.rowId,
				kind: "options",
				position: 1,
				label: "Ordinal criterion",
			},
			{
				id: numberCriterionId,
				projectId: projectRowId,
				rubricId: rubric.rowId,
				kind: "number",
				position: 2,
				label: "Numerical criterion",
			},
		])
		.returning(["id", "rowId"])
		.execute();

	const criterionRowIdById = new Map(
		insertedCriteria.map((criterion) => [criterion.id, criterion.rowId]),
	);

	const checkCriterionRowId = criterionRowIdById.get(checkCriterionId);
	const optionsCriterionRowId = criterionRowIdById.get(optionsCriterionId);
	const numberCriterionRowId = criterionRowIdById.get(numberCriterionId);

	if (
		checkCriterionRowId == null ||
		optionsCriterionRowId == null ||
		numberCriterionRowId == null
	) {
		throw new Error("Expected inserted criteria to be returned with row ids.");
	}

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: checkCriterionRowId, marks: 2 })
		.execute();

	const optionsCriterion = await db
		.insertInto("optionsCriterion")
		.values({ criterionId: optionsCriterionRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterionMark")
		.values([
			{ optionsCriterionId: optionsCriterion.id, label: "A", marks: 3 },
			{ optionsCriterionId: optionsCriterion.id, label: "B", marks: 1 },
		])
		.execute();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: numberCriterionRowId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return {
		projectId,
		rubricId,
		studentId,
		submissionId: String(submission.id),
		criterionIds: {
			boolean: checkCriterionId,
			ordinal: optionsCriterionId,
			numerical: numberCriterionId,
		},
	};
}
