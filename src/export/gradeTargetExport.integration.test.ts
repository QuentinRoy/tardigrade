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
	createMixedCriterionRubricFixtureGrid,
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

test("createCsvGradeTargetExport snapshots CSV for mixed criterion kinds and grade target states", async () => {
	const { grid, rubric } = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Export Integration Grid",
		rubricId: "q-export-test",
		checkCriterionId: "r-bool-export-test",
		optionsCriterionId: "r-ord-export-test",
		numberCriterionId: "r-num-export-test",
	});

	const criterionRowIds = await db
		.selectFrom("criterion")
		.where("gridRowId", "=", grid.rowId)
		.select(["id", "rowId"])
		.execute();
	const criterionRowId = new Map(criterionRowIds.map((r) => [r.id, r.rowId]));

	const [student1, student2, student3] = await createStudentFixtures(db, [
		{ gridRowId: grid.rowId, id: "student-export-1" },
		{ gridRowId: grid.rowId, id: "student-export-2" },
		{ gridRowId: grid.rowId, id: "student-export-3" },
	]);

	// target1: fully graded, target2: sparse (check only), target3: no grade
	const [target1, target2] = await createIndividualGradeTargetFixtures(db, [
		{ gridRowId: grid.rowId, studentRowId: student1.rowId },
		{ gridRowId: grid.rowId, studentRowId: student2.rowId },
		{ gridRowId: grid.rowId, studentRowId: student3.rowId },
	]);

	await Promise.all([
		addFullGradeFixture(db, {
			gradeTargetRowId: target1.rowId,
			checkCriterionRowId: criterionRowId.get(rubric.criteria.checkId)!,
			optionsCriterionRowId: criterionRowId.get(rubric.criteria.optionsId)!,
			numberCriterionRowId: criterionRowId.get(rubric.criteria.numberId)!,
		}),
		addSparseGrade(db, {
			gradeTargetRowId: target2.rowId,
			checkCriterionRowId: criterionRowId.get(rubric.criteria.checkId)!,
		}),
	]);

	const stream = await createCsvGradeTargetExport(
		{ includeCriterionGrade: true, includeCriterionMarks: true },
		grid.id,
		{ db },
	);
	const csv = await readStream(stream);

	expect(csv).toMatchSnapshot();
});
