import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import { buildTestId } from "./dbIntegration.ts";

export type GradedCheckFixture = CheckRubricFixture & {
	gradeTargetRowId: number;
};

export type CheckRubricFixture = {
	rubricId: string;
	rubricRowId: number;
	criterionId: string;
	criterionRowId: number;
};

// Creates a rubric carrying a single check criterion, without any grade target
// or grade.
export async function createCheckRubricFixture(
	db: Kysely<Database>,
	gridRowId: number,
	position = 0,
): Promise<CheckRubricFixture> {
	const rubricId = buildTestId("rubric");
	const criterionId = buildTestId("criterion-check");

	const rubric = await db
		.insertInto("rubric")
		.values({ gridRowId, id: rubricId, label: "Check rubric", position })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			gridRowId,
			id: criterionId,
			rubricRowId: rubric.rowId,
			kind: "check",
			position: 0,
			label: "Correct",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterion")
		.values({ criterionRowId: criterion.rowId, marks: 2, falseMarks: 0 })
		.execute();

	return {
		rubricId,
		rubricRowId: rubric.rowId,
		criterionId,
		criterionRowId: criterion.rowId,
	};
}

export async function createGradedCheckRubricFixture(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<GradedCheckFixture> {
	const rubric = await createCheckRubricFixture(db, gridRowId);
	const studentId = buildTestId("student");

	const student = await db
		.insertInto("student")
		.values({
			gridRowId,
			id: studentId,
			firstName: "Sample",
			lastName: "Student",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const target = await db
		.insertInto("gradeTarget")
		.values({ gridRowId, id: buildTestId("target") })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("gradeTargetStudent")
		.values({ gradeTargetRowId: target.rowId, studentRowId: student.rowId })
		.execute();

	await db
		.insertInto("criterionGrade")
		.values({
			gradeTargetRowId: target.rowId,
			criterionRowId: rubric.criterionRowId,
			gridRowId,
		})
		.execute();

	await db
		.insertInto("checkCriterionGrade")
		.values({
			gradeTargetRowId: target.rowId,
			criterionRowId: rubric.criterionRowId,
			passed: true,
		})
		.execute();

	return { ...rubric, gradeTargetRowId: target.rowId };
}

export async function createRubric(
	db: Kysely<Database>,
	gridRowId: number,
	position: number,
): Promise<{ id: string; rowId: number }> {
	const id = buildTestId("rubric");

	const rubric = await db
		.insertInto("rubric")
		.values({ gridRowId, id, label: `Rubric ${position}`, position })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	return { id, rowId: rubric.rowId };
}

export async function getRubricPositions(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<Record<string, number>> {
	const rows = await db
		.selectFrom("rubric")
		.select(["id", "position"])
		.where("gridRowId", "=", gridRowId)
		.execute();

	return Object.fromEntries(rows.map((row) => [row.id, row.position]));
}

export async function createOptionsRubricFixture(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<{ rubricId: string; criterionId: string }> {
	const rubricId = buildTestId("rubric-options");
	const criterionId = buildTestId("criterion-options");

	const rubric = await db
		.insertInto("rubric")
		.values({ gridRowId, id: rubricId, label: "Options rubric", position: 0 })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			gridRowId,
			id: criterionId,
			rubricRowId: rubric.rowId,
			kind: "options",
			position: 0,
			label: "Options",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterion")
		.values({ criterionRowId: criterion.rowId })
		.execute();

	await db
		.insertInto("optionsCriterionMark")
		.values([
			{ criterionRowId: criterion.rowId, label: "A", marks: 4 },
			{ criterionRowId: criterion.rowId, label: "B", marks: 2 },
		])
		.execute();

	return { rubricId, criterionId };
}
