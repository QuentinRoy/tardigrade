import type { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { DB } from "#db/generated/db.ts";
import {
	createTestDb,
	type DisposableTestDatabase,
} from "#test/dbIntegration.ts";
import { createProjectRecord } from "#test/projects.ts";
import { createCsvSubmissionExport } from "./submissionExport.ts";

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

type ProjectFixture = { id: string; rowId: number };

type QuestionFixture = {
	id: string;
	rowId: number;
	rubrics: { booleanId: string; ordinalId: string; numericalId: string };
};

type StudentFixture = { rowId: number; id: string };

async function createExportFixtureProject(
	db: Kysely<DB>,
): Promise<{ project: ProjectFixture; question: QuestionFixture }> {
	const project = await createProjectRecord(db, "Export Integration Project");

	const questionId = "q-export-test";
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

	const booleanRubricId = "r-bool-export-test";
	const ordinalRubricId = "r-ord-export-test";
	const numericalRubricId = "r-num-export-test";

	const insertedRubrics = await db
		.insertInto("rubric")
		.values([
			{
				id: booleanRubricId,
				projectId: project.rowId,
				questionId: questionRow.rowId,
				type: "boolean",
				position: 0,
				label: "Boolean",
			},
			{
				id: ordinalRubricId,
				projectId: project.rowId,
				questionId: questionRow.rowId,
				type: "ordinal",
				position: 1,
				label: "Ordinal",
			},
			{
				id: numericalRubricId,
				projectId: project.rowId,
				questionId: questionRow.rowId,
				type: "numerical",
				position: 2,
				label: "Numerical",
			},
		])
		.returning(["id", "rowId"])
		.execute();

	const rubricRowId = new Map(insertedRubrics.map((r) => [r.id, r.rowId]));

	await db
		.insertInto("booleanRubric")
		.values({
			rubricId: rubricRowId.get(booleanRubricId)!,
			marks: 2,
			falseMarks: 0,
		})
		.execute();

	const ordinalRubric = await db
		.insertInto("ordinalRubric")
		.values({ rubricId: rubricRowId.get(ordinalRubricId)! })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("ordinalRubricValue")
		.values([
			{ ordinalRubricId: ordinalRubric.id, label: "A", marks: 4 },
			{ ordinalRubricId: ordinalRubric.id, label: "B", marks: 2 },
		])
		.execute();

	await db
		.insertInto("numericalRubric")
		.values({
			rubricId: rubricRowId.get(numericalRubricId)!,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return {
		project: { id: project.id, rowId: project.rowId },
		question: {
			id: questionId,
			rowId: questionRow.rowId,
			rubrics: {
				booleanId: booleanRubricId,
				ordinalId: ordinalRubricId,
				numericalId: numericalRubricId,
			},
		},
	};
}

async function createStudent(
	db: Kysely<DB>,
	projectRowId: number,
	id: string,
): Promise<StudentFixture> {
	const row = await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id,
			firstName: "Test",
			lastName: "Student",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();
	return { rowId: row.rowId, id };
}

async function createIndividualSubmission(
	db: Kysely<DB>,
	projectRowId: number,
	studentRowId: number,
): Promise<{ id: number }> {
	return db
		.insertInto("submission")
		.values({
			projectId: projectRowId,
			type: "individual",
			studentId: studentRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();
}

async function addFullAssessment(
	db: Kysely<DB>,
	params: {
		projectRowId: number;
		submissionId: number;
		questionRowId: number;
		booleanRubricRowId: number;
		ordinalRubricRowId: number;
		numericalRubricRowId: number;
	},
) {
	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId: params.projectRowId,
			submissionId: params.submissionId,
			questionId: params.questionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const rubricAssessments = await db
		.insertInto("rubricAssessment")
		.values([
			{
				assessmentId: assessment.id,
				rubricId: params.booleanRubricRowId,
				type: "boolean",
			},
			{
				assessmentId: assessment.id,
				rubricId: params.ordinalRubricRowId,
				type: "ordinal",
			},
			{
				assessmentId: assessment.id,
				rubricId: params.numericalRubricRowId,
				type: "numerical",
			},
		])
		.returning(["id", "rubricId"])
		.execute();

	const raByRubricId = new Map(
		rubricAssessments.map((ra) => [ra.rubricId, ra.id]),
	);

	await db
		.insertInto("booleanRubricAssessment")
		.values({
			rubricAssessmentId: raByRubricId.get(params.booleanRubricRowId)!,
			passed: true,
		})
		.execute();

	await db
		.insertInto("ordinalRubricAssessment")
		.values({
			rubricAssessmentId: raByRubricId.get(params.ordinalRubricRowId)!,
			selectedLabel: "A",
		})
		.execute();

	await db
		.insertInto("numericalRubricAssessment")
		.values({
			rubricAssessmentId: raByRubricId.get(params.numericalRubricRowId)!,
			score: 7.5,
		})
		.execute();
}

async function addSparseAssessment(
	db: Kysely<DB>,
	params: {
		projectRowId: number;
		submissionId: number;
		questionRowId: number;
		booleanRubricRowId: number;
	},
) {
	const assessment = await db
		.insertInto("assessment")
		.values({
			projectId: params.projectRowId,
			submissionId: params.submissionId,
			questionId: params.questionRowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const rubricAssessment = await db
		.insertInto("rubricAssessment")
		.values({
			assessmentId: assessment.id,
			rubricId: params.booleanRubricRowId,
			type: "boolean",
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("booleanRubricAssessment")
		.values({ rubricAssessmentId: rubricAssessment.id, passed: false })
		.execute();
}

let db: DisposableTestDatabase;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db[Symbol.asyncDispose]();
});

test("createCsvSubmissionExport snapshots CSV for mixed rubric types and submission states", async () => {
	const { project, question } = await createExportFixtureProject(db);

	const rubricRowIds = await db
		.selectFrom("rubric")
		.where("projectId", "=", project.rowId)
		.select(["id", "rowId"])
		.execute();
	const rubricRowId = new Map(rubricRowIds.map((r) => [r.id, r.rowId]));

	const student1 = await createStudent(db, project.rowId, "student-export-1");
	const student2 = await createStudent(db, project.rowId, "student-export-2");
	const student3 = await createStudent(db, project.rowId, "student-export-3");

	// submission1: fully assessed
	const sub1 = await createIndividualSubmission(
		db,
		project.rowId,
		student1.rowId,
	);
	await addFullAssessment(db, {
		projectRowId: project.rowId,
		submissionId: sub1.id,
		questionRowId: question.rowId,
		booleanRubricRowId: rubricRowId.get(question.rubrics.booleanId)!,
		ordinalRubricRowId: rubricRowId.get(question.rubrics.ordinalId)!,
		numericalRubricRowId: rubricRowId.get(question.rubrics.numericalId)!,
	});

	// submission2: sparse (boolean only assessed)
	const sub2 = await createIndividualSubmission(
		db,
		project.rowId,
		student2.rowId,
	);
	await addSparseAssessment(db, {
		projectRowId: project.rowId,
		submissionId: sub2.id,
		questionRowId: question.rowId,
		booleanRubricRowId: rubricRowId.get(question.rubrics.booleanId)!,
	});

	// submission3: no assessment at all
	await createIndividualSubmission(db, project.rowId, student3.rowId);

	const stream = await createCsvSubmissionExport(
		{ includeRubricAssessment: true, includeRubricMarks: true },
		project.id,
		{ db },
	);
	const csv = await readStream(stream);

	expect(csv).toMatchSnapshot();
});
