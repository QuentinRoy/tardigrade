import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { Simplify, Writable } from "#utils/utils.ts";
import { buildTestId } from "./dbIntegration.ts";
import { createGridRecord } from "./grids.ts";

function mustGet<TKey, TValue>(map: Map<TKey, TValue>, key: TKey): TValue {
	const value = map.get(key);
	if (value == null) {
		throw new Error(`Fixture setup failed: no value for key "${String(key)}".`);
	}
	return value;
}

export type MixedCriterionRubricFixture = {
	grid: { id: string; rowId: number };
	rubric: {
		id: string;
		rowId: number;
		criteria: { checkId: string; optionsId: string; numberId: string };
	};
};

// Shared by export and import integration tests: a grid with one rubric
// that has one criterion of each kind (check/options/number). Criterion and
// rubric ids are grid-scoped, so each caller can pick its own ids
// without colliding with other tests' grids.
export async function createMixedCriterionRubricFixtureGrid(
	db: Kysely<Database>,
	params: {
		gridName: string;
		rubricId: string;
		checkCriterionId: string;
		optionsCriterionId: string;
		numberCriterionId: string;
	},
): Promise<MixedCriterionRubricFixture> {
	const {
		gridName,
		rubricId,
		checkCriterionId,
		optionsCriterionId,
		numberCriterionId,
	} = params;
	const grid = await createGridRecord(db, gridName);

	const rubricRow = await db
		.insertInto("rubric")
		.values({
			gridRowId: grid.rowId,
			id: rubricId,
			label: "Mixed rubric",
			position: 0,
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const insertedCriteria = await db
		.insertInto("criterion")
		.values([
			{
				id: checkCriterionId,
				gridRowId: grid.rowId,
				rubricId: rubricRow.rowId,
				kind: "check",
				position: 0,
				label: "Check",
			},
			{
				id: optionsCriterionId,
				gridRowId: grid.rowId,
				rubricId: rubricRow.rowId,
				kind: "options",
				position: 1,
				label: "Options",
			},
			{
				id: numberCriterionId,
				gridRowId: grid.rowId,
				rubricId: rubricRow.rowId,
				kind: "number",
				position: 2,
				label: "Number",
			},
		])
		.returning(["id", "rowId"])
		.execute();

	const criterionRowId = new Map(insertedCriteria.map((r) => [r.id, r.rowId]));

	await Promise.all([
		db
			.insertInto("checkCriterion")
			.values({
				criterionId: mustGet(criterionRowId, checkCriterionId),
				marks: 2,
				falseMarks: 0,
			})
			.execute(),
		db
			.insertInto("optionsCriterion")
			.values({ criterionId: mustGet(criterionRowId, optionsCriterionId) })
			.returning("id")
			.executeTakeFirstOrThrow()
			.then((optionsCriterion) =>
				db
					.insertInto("optionsCriterionMark")
					.values([
						{ optionsCriterionId: optionsCriterion.id, label: "A", marks: 4 },
						{ optionsCriterionId: optionsCriterion.id, label: "B", marks: 2 },
					])
					.execute(),
			),
		db
			.insertInto("numberCriterion")
			.values({
				criterionId: mustGet(criterionRowId, numberCriterionId),
				minValue: 0,
				maxValue: 10,
				minMarks: 0,
				maxMarks: 5,
			})
			.execute(),
	]);

	return {
		grid: { id: grid.id, rowId: grid.rowId },
		rubric: {
			id: rubricId,
			rowId: rubricRow.rowId,
			criteria: {
				checkId: checkCriterionId,
				optionsId: optionsCriterionId,
				numberId: numberCriterionId,
			},
		},
	};
}

// Simplify is applied per element, inside the mapped type, rather than around
// the whole tuple: that keeps `{ [K in keyof TFixtures]: ... }` a literal
// homomorphic mapped type, which is what lets TypeScript carry tuple-ness
// through `TFixtures` while it's still a generic (unresolved) parameter.
// Wrapping the entire result in Simplify instead breaks that inference.
type FixtureTuple<
	TOverride,
	TFixtures extends readonly unknown[],
	TKeep extends keyof TFixtures[number] = never,
> = {
	[K in keyof TFixtures]: Simplify<
		Writable<Pick<TFixtures[K], TKeep>> & TOverride
	>;
};

type StudentFixtureTuple<TFixtures extends readonly { id: string }[]> =
	FixtureTuple<{ rowId: number }, TFixtures, "id">;

// Inserts one or more students in a single request. Callers needing several
// students (a common case in these fixtures) avoid one round trip per
// student. Mirrors `Promise.all`'s tuple-preserving typing: passing a fixed-
// length array literal gives back a same-length, positionally-typed result,
// so callers can destructure without `undefined` checks.
export async function createStudentFixtures<
	const TFixtures extends readonly { gridRowId: number; id: string }[],
>(
	db: Kysely<Database>,
	fixtures: TFixtures,
): Promise<StudentFixtureTuple<TFixtures>> {
	const rows = await db
		.insertInto("student")
		.values(
			fixtures.map(({ gridRowId, id }) => ({
				gridRowId,
				id,
				firstName: "Test",
				lastName: "Student",
			})),
		)
		.returning(["rowId", "id"])
		.execute();

	const rowIdById = new Map(rows.map((row) => [row.id, row.rowId]));
	// biome-ignore lint/plugin/no-type-assertion: `.map()` preserves array length.
	return fixtures.map(({ id }) => ({
		id,
		rowId: mustGet(rowIdById, id),
	})) as StudentFixtureTuple<TFixtures>;
}

type GradeTargetFixtureTuple<
	TFixtures extends readonly { studentRowId: number }[],
> = FixtureTuple<{ rowId: number }, TFixtures, "studentRowId">;

// Inserts one or more individual grade targets, one per given student, each
// with the student as its sole member (an unnamed single-member target renders
// as an Individual). Targets and membership are correlated by the target's
// public id rather than by RETURNING order.
export async function createIndividualGradeTargetFixtures<
	const TFixtures extends readonly {
		gridRowId: number;
		studentRowId: number;
	}[],
>(
	db: Kysely<Database>,
	fixtures: TFixtures,
): Promise<GradeTargetFixtureTuple<TFixtures>> {
	const targetsToInsert = fixtures.map((fixture) => ({
		...fixture,
		publicId: buildTestId("target"),
	}));

	const rows = await db
		.insertInto("gradeTarget")
		.values(
			targetsToInsert.map(({ gridRowId, publicId }) => ({
				gridRowId,
				id: publicId,
			})),
		)
		.returning(["rowId", "id"])
		.execute();
	const rowIdByPublicId = new Map(rows.map((row) => [row.id, row.rowId]));

	const rowIdByStudentRowId = new Map(
		targetsToInsert.map((target) => [
			target.studentRowId,
			mustGet(rowIdByPublicId, target.publicId),
		]),
	);

	await db
		.insertInto("gradeTargetStudent")
		.values(
			Array.from(rowIdByStudentRowId, ([studentRowId, gradeTargetRowId]) => ({
				gradeTargetRowId,
				studentRowId,
			})),
		)
		.execute();

	// biome-ignore lint/plugin/no-type-assertion: `.map()` preserves array length.
	return fixtures.map(({ studentRowId }) => ({
		studentRowId,
		rowId: mustGet(rowIdByStudentRowId, studentRowId),
	})) as GradeTargetFixtureTuple<TFixtures>;
}

// Inserts one criterion grade per criterion kind for a grade target: check
// passed, options "A", number 7.5.
export async function addFullGradeFixture(
	db: Kysely<Database>,
	params: {
		gridRowId: number;
		gradeTargetRowId: number;
		checkCriterionRowId: number;
		optionsCriterionRowId: number;
		numberCriterionRowId: number;
	},
): Promise<void> {
	const criterionGrades = await db
		.insertInto("criterionGrade")
		.values([
			{
				gridRowId: params.gridRowId,
				gradeTargetRowId: params.gradeTargetRowId,
				criterionId: params.checkCriterionRowId,
			},
			{
				gridRowId: params.gridRowId,
				gradeTargetRowId: params.gradeTargetRowId,
				criterionId: params.optionsCriterionRowId,
			},
			{
				gridRowId: params.gridRowId,
				gradeTargetRowId: params.gradeTargetRowId,
				criterionId: params.numberCriterionRowId,
			},
		])
		.returning(["id", "criterionId"])
		.execute();

	const raByCriterionId = new Map(
		criterionGrades.map((ra) => [ra.criterionId, ra.id]),
	);

	await Promise.all([
		db
			.insertInto("checkCriterionGrade")
			.values({
				criterionGradeId: mustGet(raByCriterionId, params.checkCriterionRowId),
				passed: true,
			})
			.execute(),
		db
			.insertInto("optionsCriterionGrade")
			.values({
				criterionGradeId: mustGet(
					raByCriterionId,
					params.optionsCriterionRowId,
				),
				selectedLabel: "A",
			})
			.execute(),
		db
			.insertInto("numberCriterionGrade")
			.values({
				criterionGradeId: mustGet(raByCriterionId, params.numberCriterionRowId),
				value: 7.5,
			})
			.execute(),
	]);
}
