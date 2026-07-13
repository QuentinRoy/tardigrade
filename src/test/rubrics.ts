import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import { buildTestId } from "./dbIntegration.ts";

export type AssessedBooleanFixture = BooleanRubricFixture & {
	gradeTargetRowId: number;
	criterionAssessmentId: number;
};

export type BooleanRubricFixture = {
	rubricId: string;
	rubricRowId: number;
	criterionId: string;
	criterionRowId: number;
};

// Creates a rubric carrying a single boolean criterion, without any grade target
// or assessment.
export async function createBooleanRubricFixture(
	db: Kysely<Database>,
	projectId: number,
	position = 0,
): Promise<BooleanRubricFixture> {
	const rubricId = buildTestId("rubric");
	const criterionId = buildTestId("criterion-boolean");

	const rubric = await db
		.insertInto("rubric")
		.values({ projectId, id: rubricId, label: "Boolean rubric", position })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			projectId,
			id: criterionId,
			rubricId: rubric.rowId,
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
		rubricId,
		rubricRowId: rubric.rowId,
		criterionId,
		criterionRowId: criterion.rowId,
	};
}

export async function createAssessedBooleanRubricFixture(
	db: Kysely<Database>,
	projectId: number,
): Promise<AssessedBooleanFixture> {
	const rubric = await createBooleanRubricFixture(db, projectId);
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

	const target = await db
		.insertInto("gradeTarget")
		.values({
			projectId,
			id: buildTestId("target"),
			kind: "individual",
			studentRowId: student.rowId,
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterionAssessment = await db
		.insertInto("criterionAssessment")
		.values({
			gradeTargetRowId: target.rowId,
			criterionId: rubric.criterionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionAssessment")
		.values({ criterionAssessmentId: criterionAssessment.id, passed: true })
		.execute();

	return {
		...rubric,
		gradeTargetRowId: target.rowId,
		criterionAssessmentId: criterionAssessment.id,
	};
}

export async function createRubric(
	db: Kysely<Database>,
	projectId: number,
	position: number,
): Promise<{ id: string; rowId: number }> {
	const id = buildTestId("rubric");

	const rubric = await db
		.insertInto("rubric")
		.values({ projectId, id, label: `Rubric ${position}`, position })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	return { id, rowId: rubric.rowId };
}

export async function getRubricPositions(
	db: Kysely<Database>,
	projectId: number,
): Promise<Record<string, number>> {
	const rows = await db
		.selectFrom("rubric")
		.select(["id", "position"])
		.where("projectId", "=", projectId)
		.execute();

	return Object.fromEntries(rows.map((row) => [row.id, row.position]));
}

export async function createOrdinalRubricFixture(
	db: Kysely<Database>,
	projectId: number,
): Promise<{ rubricId: string; criterionId: string }> {
	const rubricId = buildTestId("rubric-ordinal");
	const criterionId = buildTestId("criterion-ordinal");

	const rubric = await db
		.insertInto("rubric")
		.values({ projectId, id: rubricId, label: "Ordinal rubric", position: 0 })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			projectId,
			id: criterionId,
			rubricId: rubric.rowId,
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

	return { rubricId, criterionId };
}
