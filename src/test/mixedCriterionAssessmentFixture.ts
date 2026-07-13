import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { Simplify, Writable } from "#utils/utils.ts";
import { buildTestId } from "./dbIntegration.ts";
import { createProjectRecord } from "./projects.ts";

function mustGet<TKey, TValue>(map: Map<TKey, TValue>, key: TKey): TValue {
	const value = map.get(key);
	if (value == null) {
		throw new Error(`Fixture setup failed: no value for key "${String(key)}".`);
	}
	return value;
}

export type MixedCriterionRubricFixture = {
	project: { id: string; rowId: number };
	rubric: {
		id: string;
		rowId: number;
		criteria: { booleanId: string; ordinalId: string; numericalId: string };
	};
};

// Shared by export and import integration tests: a project with one rubric
// that has one criterion of each type (boolean/ordinal/numerical). Criterion and
// rubric ids are project-scoped, so each caller can pick its own ids
// without colliding with other tests' projects.
export async function createMixedCriterionRubricFixtureProject(
	db: Kysely<Database>,
	params: {
		projectName: string;
		rubricId: string;
		checkCriterionId: string;
		optionsCriterionId: string;
		numberCriterionId: string;
	},
): Promise<MixedCriterionRubricFixture> {
	const {
		projectName,
		rubricId,
		checkCriterionId,
		optionsCriterionId,
		numberCriterionId,
	} = params;
	const project = await createProjectRecord(db, projectName);

	const rubricRow = await db
		.insertInto("rubric")
		.values({
			projectId: project.rowId,
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
				projectId: project.rowId,
				rubricId: rubricRow.rowId,
				kind: "check",
				position: 0,
				label: "Boolean",
			},
			{
				id: optionsCriterionId,
				projectId: project.rowId,
				rubricId: rubricRow.rowId,
				kind: "options",
				position: 1,
				label: "Ordinal",
			},
			{
				id: numberCriterionId,
				projectId: project.rowId,
				rubricId: rubricRow.rowId,
				kind: "number",
				position: 2,
				label: "Numerical",
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
				minScore: 0,
				maxScore: 10,
				minMarks: 0,
				maxMarks: 5,
			})
			.execute(),
	]);

	return {
		project: { id: project.id, rowId: project.rowId },
		rubric: {
			id: rubricId,
			rowId: rubricRow.rowId,
			criteria: {
				booleanId: checkCriterionId,
				ordinalId: optionsCriterionId,
				numericalId: numberCriterionId,
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
	const TFixtures extends readonly { projectRowId: number; id: string }[],
>(
	db: Kysely<Database>,
	fixtures: TFixtures,
): Promise<StudentFixtureTuple<TFixtures>> {
	const rows = await db
		.insertInto("student")
		.values(
			fixtures.map(({ projectRowId, id }) => ({
				projectId: projectRowId,
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

// Inserts one or more individual grade targets in a single request, one per
// given student.
export async function createIndividualGradeTargetFixtures<
	const TFixtures extends readonly {
		projectRowId: number;
		studentRowId: number;
	}[],
>(
	db: Kysely<Database>,
	fixtures: TFixtures,
): Promise<GradeTargetFixtureTuple<TFixtures>> {
	const rows = await db
		.insertInto("gradeTarget")
		.values(
			fixtures.map(({ projectRowId, studentRowId }) => ({
				projectId: projectRowId,
				id: buildTestId("target"),
				kind: "individual" as const,
				studentRowId,
			})),
		)
		.returning(["rowId", "studentRowId"])
		.execute();

	const rowIdByStudentRowId = new Map(
		rows.map((row) => [row.studentRowId, row.rowId]),
	);
	// biome-ignore lint/plugin/no-type-assertion: `.map()` preserves array length.
	return fixtures.map(({ studentRowId }) => ({
		studentRowId,
		rowId: mustGet(rowIdByStudentRowId, studentRowId),
	})) as GradeTargetFixtureTuple<TFixtures>;
}

// Inserts one criterion grade per criterion kind for a grade target: boolean
// passed, ordinal "A", numerical 7.5.
export async function addFullAssessmentFixture(
	db: Kysely<Database>,
	params: {
		gradeTargetRowId: number;
		checkCriterionRowId: number;
		optionsCriterionRowId: number;
		numberCriterionRowId: number;
	},
): Promise<void> {
	const criterionAssessments = await db
		.insertInto("criterionAssessment")
		.values([
			{
				gradeTargetRowId: params.gradeTargetRowId,
				criterionId: params.checkCriterionRowId,
			},
			{
				gradeTargetRowId: params.gradeTargetRowId,
				criterionId: params.optionsCriterionRowId,
			},
			{
				gradeTargetRowId: params.gradeTargetRowId,
				criterionId: params.numberCriterionRowId,
			},
		])
		.returning(["id", "criterionId"])
		.execute();

	const raByCriterionId = new Map(
		criterionAssessments.map((ra) => [ra.criterionId, ra.id]),
	);

	await Promise.all([
		db
			.insertInto("checkCriterionAssessment")
			.values({
				criterionAssessmentId: mustGet(
					raByCriterionId,
					params.checkCriterionRowId,
				),
				passed: true,
			})
			.execute(),
		db
			.insertInto("optionsCriterionAssessment")
			.values({
				criterionAssessmentId: mustGet(
					raByCriterionId,
					params.optionsCriterionRowId,
				),
				selectedLabel: "A",
			})
			.execute(),
		db
			.insertInto("numberCriterionAssessment")
			.values({
				criterionAssessmentId: mustGet(
					raByCriterionId,
					params.numberCriterionRowId,
				),
				score: 7.5,
			})
			.execute(),
	]);
}
