import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import { loadGradeTargetGradesFromDb } from "#grading/grades.ts";
import { buildTestId, type createTestDb } from "./dbIntegration.ts";

export type GradeFixture = {
	gridId: string;
	rubricId: string;
	studentId: string;
	gradeTargetId: string;
	criterionIds: { check: string; options: string; number: string };
};

export type GradeFixtureOptions = {
	rubricId?: string;
	criterionIds?: { check: string; options: string; number: string };
};

// Creates a grade target with a rubric carrying one criterion of each type, ready for
// grade round-trips. Exposes the Grid ID (public identifier); the Grid
// Row ID stays internal to the fixture plumbing. Cleanup is handled by disposing
// the owning grid (cascade), so no separate teardown helper is needed.
export async function createGradeFixture(
	db: Kysely<Database>,
	gridId: string,
	options?: GradeFixtureOptions,
): Promise<GradeFixture> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();

	const gridRowId = grid.rowId;

	const rubricId = options?.rubricId ?? buildTestId("q");
	const studentId = buildTestId("student");
	const checkCriterionId =
		options?.criterionIds?.check ?? buildTestId("criterion-check");
	const optionsCriterionId =
		options?.criterionIds?.options ?? buildTestId("criterion-options");
	const numberCriterionId =
		options?.criterionIds?.number ?? buildTestId("criterion-number");

	await db
		.insertInto("student")
		.values({
			gridRowId: gridRowId,
			id: studentId,
			lastName: "Integration",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const target = await db
		.insertInto("gradeTarget")
		.values({
			gridRowId: gridRowId,
			id: buildTestId("target"),
			kind: "individual",
			studentRowId: studentRow.rowId,
		})
		.returning(["id", "rowId"])
		.executeTakeFirstOrThrow();

	await db
		.insertInto("rubric")
		.values({
			gridRowId: gridRowId,
			id: rubricId,
			label: "Integration rubric",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select(["id", "rowId"])
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const insertedCriteria = await db
		.insertInto("criterion")
		.values([
			{
				id: checkCriterionId,
				gridRowId: gridRowId,
				rubricId: rubric.rowId,
				kind: "check",
				position: 0,
				label: "Check criterion",
			},
			{
				id: optionsCriterionId,
				gridRowId: gridRowId,
				rubricId: rubric.rowId,
				kind: "options",
				position: 1,
				label: "Options criterion",
			},
			{
				id: numberCriterionId,
				gridRowId: gridRowId,
				rubricId: rubric.rowId,
				kind: "number",
				position: 2,
				label: "Number criterion",
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
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return {
		gridId,
		rubricId,
		studentId,
		gradeTargetId: target.id,
		criterionIds: {
			check: checkCriterionId,
			options: optionsCriterionId,
			number: numberCriterionId,
		},
	};
}

export async function rubricSlice(
	db: Awaited<ReturnType<typeof createTestDb>>,
	fixture: GradeFixture,
) {
	const byRubricId = await loadGradeTargetGradesFromDb(db, {
		targetId: fixture.gradeTargetId,
		gridId: fixture.gridId,
	});
	return byRubricId[fixture.rubricId] ?? [];
}
