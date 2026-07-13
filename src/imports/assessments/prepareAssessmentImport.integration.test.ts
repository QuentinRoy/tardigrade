import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createCsvGradeTargetExport } from "#export/gradeTargetExport.ts";
import type { ExportOptions } from "#export/gradeTargetExportCsv.ts";
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
import { loadAssessmentImportContextFromDb } from "./assessmentImportContext.ts";
import { parseAssessmentsCsv } from "./parseAssessments.ts";
import { prepareAssessmentImport } from "./prepareAssessmentImport.ts";

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

async function createRoundtripFixtureProject(db: DisposableTestDatabase) {
	const { project, rubric } = await createMixedCriterionRubricFixtureProject(
		db,
		{
			projectName: "Roundtrip Integration Project",
			rubricId: "q-roundtrip-test",
			checkCriterionId: "r-bool-roundtrip-test",
			optionsCriterionId: "r-ord-roundtrip-test",
			numberCriterionId: "r-num-roundtrip-test",
		},
	);

	const criterionRowIds = await db
		.selectFrom("criterion")
		.where("projectId", "=", project.rowId)
		.select(["id", "rowId"])
		.execute();
	const criterionRowId = new Map(criterionRowIds.map((r) => [r.id, r.rowId]));

	const [student] = await createStudentFixtures(db, [
		{ projectRowId: project.rowId, id: "student-roundtrip-1" },
	]);
	const [target] = await createIndividualGradeTargetFixtures(db, [
		{ projectRowId: project.rowId, studentRowId: student.rowId },
	]);
	await addFullAssessmentFixture(db, {
		gradeTargetRowId: target.rowId,
		checkCriterionRowId: criterionRowId.get(rubric.criteria.booleanId)!,
		optionsCriterionRowId: criterionRowId.get(rubric.criteria.ordinalId)!,
		numberCriterionRowId: criterionRowId.get(rubric.criteria.numericalId)!,
	});

	const targetRow = await db
		.selectFrom("gradeTarget")
		.select("id")
		.where("rowId", "=", target.rowId)
		.executeTakeFirstOrThrow();

	return {
		project,
		targetId: targetRow.id,
		rubricId: rubric.id,
		criterionIds: rubric.criteria,
	};
}

let db: DisposableTestDatabase;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db[Symbol.asyncDispose]();
});

// Whether marks/total columns are included in the export must not affect the
// import plan: those columns are always recognized-and-ignored, never
// imported (see `prepareAssessmentImport`'s derived-column handling). Both
// scenarios below assert the identical plan for that reason.
describe.each<{ name: string; options: ExportOptions }>([
	{
		name: "full export",
		options: { includeCriterionAssessment: true, includeCriterionMarks: true },
	},
	{
		name: "assessment-only export",
		options: { includeCriterionAssessment: true, includeCriterionMarks: false },
	},
])("$name re-imports into the same project without drift", ({ options }) => {
	test("plan reproduces the seeded assessment values exactly", async () => {
		const fixture = await createRoundtripFixtureProject(db);

		const stream = await createCsvGradeTargetExport(
			options,
			fixture.project.id,
			{ db },
		);
		const csv = await readStream(stream);

		const rows = await parseAssessmentsCsv(csv);
		const context = await loadAssessmentImportContextFromDb(db, {
			rows,
			projectId: fixture.project.id,
		});
		const plan = prepareAssessmentImport({ rows, context });

		expect(plan.blockingDiagnostics).toEqual([]);
		expect(plan.writes).toEqual(
			expect.arrayContaining([
				{
					targetId: fixture.targetId,
					rubricId: fixture.rubricId,
					assessment: {
						criterionId: fixture.criterionIds.booleanId,
						kind: "check",
						passed: true,
					},
				},
				{
					targetId: fixture.targetId,
					rubricId: fixture.rubricId,
					assessment: {
						criterionId: fixture.criterionIds.ordinalId,
						kind: "options",
						selectedLabel: "A",
					},
				},
				{
					targetId: fixture.targetId,
					rubricId: fixture.rubricId,
					assessment: {
						criterionId: fixture.criterionIds.numericalId,
						kind: "number",
						score: 7.5,
					},
				},
			]),
		);
		expect(plan.writes).toHaveLength(3);
		expect(plan.overwrites).toHaveLength(3);
	});
});

test("marks-only export re-import is blocked with no-assessment-columns", async () => {
	const fixture = await createRoundtripFixtureProject(db);

	const stream = await createCsvGradeTargetExport(
		{ includeCriterionAssessment: false, includeCriterionMarks: true },
		fixture.project.id,
		{ db },
	);
	const csv = await readStream(stream);

	const rows = await parseAssessmentsCsv(csv);
	const context = await loadAssessmentImportContextFromDb(db, {
		rows,
		projectId: fixture.project.id,
	});
	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([{ type: "no-assessment-columns" }]);
	expect(plan.writes).toEqual([]);
});
