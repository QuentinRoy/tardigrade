import type { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { DB } from "#db/generated/db.ts";
import {
	createTestDb,
	type DisposableTestDatabase,
} from "#test/dbIntegration.ts";
import {
	addFullAssessmentFixture,
	createIndividualGradeTargetFixtures,
	createMixedCriterionRubricFixtureProject,
	createStudentFixtures,
} from "#test/mixedCriterionAssessmentFixture.ts";
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

async function addSparseAssessment(
	db: Kysely<DB>,
	params: {
		projectRowId: number;
		gradeTargetRowId: number;
		rubricRowId: number;
		checkCriterionRowId: number;
	},
) {
	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId: params.projectRowId,
			gradeTargetRowId: params.gradeTargetRowId,
			rubricId: params.rubricRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const criterionAssessment = await db
		.insertInto("criterionAssessment")
		.values({
			assessmentId: assessment.id,
			criterionId: params.checkCriterionRowId,
			kind: "check",
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionAssessment")
		.values({ criterionAssessmentId: criterionAssessment.id, passed: false })
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

	// target1: fully assessed, target2: sparse (check only), target3: no assessment
	const [target1, target2] = await createIndividualGradeTargetFixtures(db, [
		{ projectRowId: project.rowId, studentRowId: student1.rowId },
		{ projectRowId: project.rowId, studentRowId: student2.rowId },
		{ projectRowId: project.rowId, studentRowId: student3.rowId },
	]);

	await Promise.all([
		addFullAssessmentFixture(db, {
			projectRowId: project.rowId,
			gradeTargetRowId: target1.rowId,
			rubricRowId: rubric.rowId,
			checkCriterionRowId: criterionRowId.get(rubric.criteria.booleanId)!,
			optionsCriterionRowId: criterionRowId.get(rubric.criteria.ordinalId)!,
			numberCriterionRowId: criterionRowId.get(rubric.criteria.numericalId)!,
		}),
		addSparseAssessment(db, {
			projectRowId: project.rowId,
			gradeTargetRowId: target2.rowId,
			rubricRowId: rubric.rowId,
			checkCriterionRowId: criterionRowId.get(rubric.criteria.booleanId)!,
		}),
	]);

	const stream = await createCsvGradeTargetExport(
		{ includeCriterionAssessment: true, includeCriterionMarks: true },
		project.id,
		{ db },
	);
	const csv = await readStream(stream);

	expect(csv).toMatchSnapshot();
});
