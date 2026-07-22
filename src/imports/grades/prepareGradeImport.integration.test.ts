import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createCsvGradeTargetExport } from "#export/gradeTargetExport.ts";
import type { ExportOptions } from "#export/gradeTargetExportCsv.ts";
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
import { loadGradeImportContextFromDb } from "./gradeImportContext.ts";
import { parseGradesCsv } from "./parseGrades.ts";
import { prepareGradeImport } from "./prepareGradeImport.ts";

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

async function createRoundtripFixtureGrid(db: DisposableTestDatabase) {
	const { grid, rubric } = await createMixedCriterionRubricFixtureGrid(db, {
		gridName: "Roundtrip Integration Grid",
		rubricId: "q-roundtrip-test",
		checkCriterionId: "r-bool-roundtrip-test",
		optionsCriterionId: "r-ord-roundtrip-test",
		numberCriterionId: "r-num-roundtrip-test",
	});

	const criterionRowIds = await db
		.selectFrom("criterion")
		.where("gridRowId", "=", grid.rowId)
		.select(["id", "rowId"])
		.execute();
	const criterionRowId = new Map(criterionRowIds.map((r) => [r.id, r.rowId]));

	const [student] = await createStudentFixtures(db, [
		{ gridRowId: grid.rowId, id: "student-roundtrip-1" },
	]);
	const [target] = await createIndividualGradeTargetFixtures(db, [
		{ gridRowId: grid.rowId, studentRowId: student.rowId },
	]);
	await addFullGradeFixture(db, {
		gridRowId: grid.rowId,
		gradeTargetRowId: target.rowId,
		checkCriterionRowId: criterionRowId.get(rubric.criteria.checkId)!,
		optionsCriterionRowId: criterionRowId.get(rubric.criteria.optionsId)!,
		numberCriterionRowId: criterionRowId.get(rubric.criteria.numberId)!,
	});

	const targetRow = await db
		.selectFrom("gradeTarget")
		.select("id")
		.where("rowId", "=", target.rowId)
		.executeTakeFirstOrThrow();

	return {
		grid,
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
// imported (see `prepareGradeImport`'s derived-column handling). Both
// scenarios below assert the identical plan for that reason.
describe.each<{ name: string; options: ExportOptions }>([
	{
		name: "full export",
		options: { includeCriterionGrade: true, includeCriterionMarks: true },
	},
	{
		name: "grade-only export",
		options: { includeCriterionGrade: true, includeCriterionMarks: false },
	},
])("$name re-imports into the same grid without drift", ({ options }) => {
	test("plan reproduces the seeded grade values exactly", async () => {
		const fixture = await createRoundtripFixtureGrid(db);

		const stream = await createCsvGradeTargetExport(options, fixture.grid.id, {
			db,
		});
		const csv = await readStream(stream);

		const rows = await parseGradesCsv(csv);
		const context = await loadGradeImportContextFromDb(db, {
			rows,
			gridId: fixture.grid.id,
		});
		expect(
			context.criteriaByColumn.get(
				`${fixture.rubricId}:${fixture.criterionIds.numberId}`,
			),
		).toEqual({
			id: fixture.criterionIds.numberId,
			kind: "number",
			rubricId: fixture.rubricId,
			optionsLabels: [],
			minValue: 0,
			maxValue: 10,
		});
		const plan = prepareGradeImport({ rows, context });

		expect(plan.blockingDiagnostics).toEqual([]);
		expect(plan.writes).toEqual(
			expect.arrayContaining([
				{
					targetId: fixture.targetId,
					rubricId: fixture.rubricId,
					grade: {
						criterionId: fixture.criterionIds.checkId,
						kind: "check",
						passed: true,
					},
				},
				{
					targetId: fixture.targetId,
					rubricId: fixture.rubricId,
					grade: {
						criterionId: fixture.criterionIds.optionsId,
						kind: "options",
						selectedLabel: "A",
					},
				},
				{
					targetId: fixture.targetId,
					rubricId: fixture.rubricId,
					grade: {
						criterionId: fixture.criterionIds.numberId,
						kind: "number",
						value: 7.5,
					},
				},
			]),
		);
		expect(plan.writes).toHaveLength(3);
		expect(plan.overwrites).toHaveLength(3);
	});
});

test("marks-only export re-import is blocked with no-grade-columns", async () => {
	const fixture = await createRoundtripFixtureGrid(db);

	const stream = await createCsvGradeTargetExport(
		{ includeCriterionGrade: false, includeCriterionMarks: true },
		fixture.grid.id,
		{ db },
	);
	const csv = await readStream(stream);

	const rows = await parseGradesCsv(csv);
	const context = await loadGradeImportContextFromDb(db, {
		rows,
		gridId: fixture.grid.id,
	});
	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([{ type: "no-grade-columns" }]);
	expect(plan.writes).toEqual([]);
});
