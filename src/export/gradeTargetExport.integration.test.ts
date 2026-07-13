import type { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Database } from "#db/generated/database.ts";
import {
	createTestDb,
	type DisposableTestDatabase,
} from "#test/dbIntegration.ts";
import {
	addFullGradeFixture,
	createIndividualGradeTargetFixtures,
	createMixedCriterionRubricFixtureProject,
	createStudentFixtures,
} from "#test/mixedCriterionGradeFixture.ts";
import { createCsvGradeTargetExport } from "./gradeTargetExport.ts";

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let content = "";

	while (true) {
		const result = await reader.read();
		if (result.done) break;
		content += decoder.decode(result.value, { stream: true });
	}

	content += decoder.decode();
	return content;
}

async function addSparseGrade(
	db: Kysely<Database>,
	params: { gradeTargetRowId: number; checkCriterionRowId: number },
) {
	const criterionGrade = await db
		.insertInto("criterionGrade")
		.values({
			gradeTargetRowId: params.gradeTargetRowId,
			criterionId: params.checkCriterionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionGrade")
		.values({ criterionGradeId: criterionGrade.id, passed: false })
		.execute();
}

let db: DisposableTestDatabase;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db[Symbol.asyncDispose]();
});

test("createCsvGradeTargetExport snapshots CSV for mixed criterion types and grade target states", async () => {
	const { project, rubric } = await createMixedCriterionRubricFixtureProject(
		db,
		{
			projectName: "Export Integration Project",
			rubricId: "q-export-test",
			checkCriterionId: "r-bool-export-test",
			optionsCriterionId: "r-ord-export-test",
			numberCriterionId: "r-num-export-test",
		},
	);

	const criterionRowIds = await db
		.selectFrom("criterion")
		.where("projectId", "=", project.rowId)
		.select(["id", "rowId"])
		.execute();
	const criterionRowId = new Map(criterionRowIds.map((r) => [r.id, r.rowId]));

	const [student1, student2, student3] = await createStudentFixtures(db, [
		{ projectRowId: project.rowId, id: "student-export-1" },
		{ projectRowId: project.rowId, id: "student-export-2" },
		{ projectRowId: project.rowId, id: "student-export-3" },
	]);

	// target1: fully graded, target2: sparse (check only), target3: no grade
	const [target1, target2] = await createIndividualGradeTargetFixtures(db, [
		{ projectRowId: project.rowId, studentRowId: student1.rowId },
		{ projectRowId: project.rowId, studentRowId: student2.rowId },
		{ projectRowId: project.rowId, studentRowId: student3.rowId },
	]);

	await Promise.all([
		addFullGradeFixture(db, {
			gradeTargetRowId: target1.rowId,
			checkCriterionRowId: criterionRowId.get(rubric.criteria.booleanId)!,
			optionsCriterionRowId: criterionRowId.get(rubric.criteria.ordinalId)!,
			numberCriterionRowId: criterionRowId.get(rubric.criteria.numericalId)!,
		}),
		addSparseGrade(db, {
			gradeTargetRowId: target2.rowId,
			checkCriterionRowId: criterionRowId.get(rubric.criteria.booleanId)!,
		}),
	]);

	const stream = await createCsvGradeTargetExport(
		{ includeCriterionGrade: true, includeCriterionMarks: true },
		project.id,
		{ db },
	);
	const csv = await readStream(stream);

	expect(csv).toMatchSnapshot();
});
