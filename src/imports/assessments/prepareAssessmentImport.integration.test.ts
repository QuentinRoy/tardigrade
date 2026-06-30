import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createCsvSubmissionExport } from "#export/submissionExport.ts";
import type { ExportOptions } from "#export/submissionExportCsv.ts";
import {
	createTestDb,
	type DisposableTestDatabase,
} from "#test/dbIntegration.ts";
import {
	addFullAssessmentFixture,
	createIndividualSubmissionFixtures,
	createMixedRubricQuestionFixtureProject,
	createStudentFixtures,
} from "#test/mixedRubricAssessmentFixture.ts";
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
	const { project, question } = await createMixedRubricQuestionFixtureProject(
		db,
		{
			projectName: "Roundtrip Integration Project",
			questionId: "q-roundtrip-test",
			booleanRubricId: "r-bool-roundtrip-test",
			ordinalRubricId: "r-ord-roundtrip-test",
			numericalRubricId: "r-num-roundtrip-test",
		},
	);

	const rubricRowIds = await db
		.selectFrom("rubric")
		.where("projectId", "=", project.rowId)
		.select(["id", "rowId"])
		.execute();
	const rubricRowId = new Map(rubricRowIds.map((r) => [r.id, r.rowId]));

	const [student] = await createStudentFixtures(db, [
		{ projectRowId: project.rowId, id: "student-roundtrip-1" },
	]);
	const [submission] = await createIndividualSubmissionFixtures(db, [
		{ projectRowId: project.rowId, studentRowId: student.rowId },
	]);
	await addFullAssessmentFixture(db, {
		projectRowId: project.rowId,
		submissionId: submission.id,
		questionRowId: question.rowId,
		booleanRubricRowId: rubricRowId.get(question.rubrics.booleanId)!,
		ordinalRubricRowId: rubricRowId.get(question.rubrics.ordinalId)!,
		numericalRubricRowId: rubricRowId.get(question.rubrics.numericalId)!,
	});

	return {
		project,
		submissionId: String(submission.id),
		questionId: question.id,
		rubricIds: question.rubrics,
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
		options: { includeRubricAssessment: true, includeRubricMarks: true },
	},
	{
		name: "assessment-only export",
		options: { includeRubricAssessment: true, includeRubricMarks: false },
	},
])("$name re-imports into the same project without drift", ({ options }) => {
	test("plan reproduces the seeded assessment values exactly", async () => {
		const fixture = await createRoundtripFixtureProject(db);

		const stream = await createCsvSubmissionExport(
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
					submissionId: fixture.submissionId,
					questionId: fixture.questionId,
					assessment: {
						rubricId: fixture.rubricIds.booleanId,
						type: "boolean",
						passed: true,
					},
				},
				{
					submissionId: fixture.submissionId,
					questionId: fixture.questionId,
					assessment: {
						rubricId: fixture.rubricIds.ordinalId,
						type: "ordinal",
						selectedLabel: "A",
					},
				},
				{
					submissionId: fixture.submissionId,
					questionId: fixture.questionId,
					assessment: {
						rubricId: fixture.rubricIds.numericalId,
						type: "numerical",
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

	const stream = await createCsvSubmissionExport(
		{ includeRubricAssessment: false, includeRubricMarks: true },
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
