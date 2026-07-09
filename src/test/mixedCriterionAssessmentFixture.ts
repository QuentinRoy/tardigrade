import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import type { Simplify, Writable } from "#utils/utils.ts";
import { createProjectRecord } from "./projects.ts";

function mustGet<TKey, TValue>(map: Map<TKey, TValue>, key: TKey): TValue {
	const value = map.get(key);
	if (value == null) {
		throw new Error(`Fixture setup failed: no value for key "${String(key)}".`);
	}
	return value;
}

export type MixedCriterionQuestionFixture = {
	project: { id: string; rowId: number };
	question: {
		id: string;
		rowId: number;
		criteria: { booleanId: string; ordinalId: string; numericalId: string };
	};
};

// Shared by export and import integration tests: a project with one question
// that has one criterion of each type (boolean/ordinal/numerical). Criterion and
// question ids are project-scoped, so each caller can pick its own ids
// without colliding with other tests' projects.
export async function createMixedCriterionQuestionFixtureProject(
	db: Kysely<DB>,
	params: {
		projectName: string;
		questionId: string;
		checkCriterionId: string;
		optionsCriterionId: string;
		numberCriterionId: string;
	},
): Promise<MixedCriterionQuestionFixture> {
	const {
		projectName,
		questionId,
		checkCriterionId,
		optionsCriterionId,
		numberCriterionId,
	} = params;
	const project = await createProjectRecord(db, projectName);

	const questionRow = await db
		.insertInto("question")
		.values({
			projectId: project.rowId,
			id: questionId,
			label: "Mixed question",
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
				questionId: questionRow.rowId,
				kind: "check",
				position: 0,
				label: "Boolean",
			},
			{
				id: optionsCriterionId,
				projectId: project.rowId,
				questionId: questionRow.rowId,
				kind: "options",
				position: 1,
				label: "Ordinal",
			},
			{
				id: numberCriterionId,
				projectId: project.rowId,
				questionId: questionRow.rowId,
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
		question: {
			id: questionId,
			rowId: questionRow.rowId,
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
	db: Kysely<DB>,
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

type SubmissionFixtureTuple<
	TFixtures extends readonly { studentRowId: number }[],
> = FixtureTuple<{ id: number }, TFixtures, "studentRowId">;

// Inserts one or more individual submissions in a single request, one per
// given student.
export async function createIndividualSubmissionFixtures<
	const TFixtures extends readonly {
		projectRowId: number;
		studentRowId: number;
	}[],
>(
	db: Kysely<DB>,
	fixtures: TFixtures,
): Promise<SubmissionFixtureTuple<TFixtures>> {
	const rows = await db
		.insertInto("submission")
		.values(
			fixtures.map(({ projectRowId, studentRowId }) => ({
				projectId: projectRowId,
				type: "individual" as const,
				studentId: studentRowId,
			})),
		)
		.returning(["id", "studentId"])
		.execute();

	const idByStudentRowId = new Map(rows.map((row) => [row.studentId, row.id]));
	// biome-ignore lint/plugin/no-type-assertion: `.map()` preserves array length.
	return fixtures.map(({ studentRowId }) => ({
		studentRowId,
		id: mustGet(idByStudentRowId, studentRowId),
	})) as SubmissionFixtureTuple<TFixtures>;
}

// Inserts one assessment with all three criterion types filled in: boolean
// passed, ordinal "A", numerical 7.5.
export async function addFullAssessmentFixture(
	db: Kysely<DB>,
	params: {
		projectRowId: number;
		submissionId: number;
		questionRowId: number;
		checkCriterionRowId: number;
		optionsCriterionRowId: number;
		numberCriterionRowId: number;
	},
): Promise<void> {
	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId: params.projectRowId,
			submissionId: params.submissionId,
			questionId: params.questionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const criterionAssessments = await db
		.insertInto("criterionAssessment")
		.values([
			{
				assessmentId: assessment.id,
				criterionId: params.checkCriterionRowId,
				kind: "check",
			},
			{
				assessmentId: assessment.id,
				criterionId: params.optionsCriterionRowId,
				kind: "options",
			},
			{
				assessmentId: assessment.id,
				criterionId: params.numberCriterionRowId,
				kind: "number",
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
