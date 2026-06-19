import { type Kysely } from "kysely";
import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { saveAssessments } from "./saveAssessments.ts";
import type { ImportedAssessmentRow } from "./types.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

async function createAssessmentFixture(
	db: Kysely<DB>,
	projectId: number,
): Promise<{
	questionId: string;
	studentId: string;
	submissionId: string;
	rubricId: string;
	numericalRubricId: string;
}> {
	const questionId = buildTestId("question");
	const studentId = buildTestId("student");
	const rubricId = buildTestId("rubric");
	const numericalRubricId = buildTestId("rubric-numerical");

	await db
		.insertInto("student")
		.values({
			projectId,
			id: studentId,
			lastName: "Import",
			firstName: "Student",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("projectId", "=", projectId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const submission = await db
		.insertInto("submission")
		.values({ projectId, type: "individual", studentId: studentRow.rowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("question")
		.values({
			projectId,
			id: questionId,
			label: "Import question",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select(["id", "rowId"])
		.where("projectId", "=", projectId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	const rubric = await db
		.insertInto("rubric")
		.values({
			id: rubricId,
			projectId,
			questionId: question.rowId,
			type: "boolean",
			position: 0,
			label: "Correctness",
		})
		.returning(["id", "rowId"])
		.execute();

	const createdRubric = rubric[0];

	if (createdRubric == null) {
		throw new Error("Expected rubric row to be created for fixture setup.");
	}

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: createdRubric.rowId, marks: 2, falseMarks: 0 })
		.execute();

	const numericalRubric = await db
		.insertInto("rubric")
		.values({
			id: numericalRubricId,
			projectId,
			questionId: question.rowId,
			type: "numerical",
			position: 1,
			label: "Score",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numericalRubric")
		.values({
			rubricId: numericalRubric.rowId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	return {
		questionId,
		studentId,
		submissionId: String(submission.id),
		rubricId,
		numericalRubricId,
	};
}

test("saveAssessments does not persist valid rows when a later row fails validation", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Atomic Import Project");
	const projectPublicId = project.id;
	const fixture = await createAssessmentFixture(db, project.rowId);

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "true",
		},
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "not-a-boolean",
		},
	];

	await expect(
		saveAssessments({ rows, projectId: projectPublicId }, { db }),
	).rejects.toThrow("Assessment import errors:");

	const persistedAssessments = await db
		.selectFrom("assessment")
		.select("id")
		.where("projectId", "=", project.rowId)
		.execute();

	expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments rejects unknown columns before writing any assessment", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Unknown Column Project");
	const projectPublicId = project.id;
	const fixture = await createAssessmentFixture(db, project.rowId);

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			unknown_column: "oops",
			[`${fixture.questionId}:${fixture.rubricId}`]: "true",
		},
	];

	await expect(
		saveAssessments({ rows, projectId: projectPublicId }, { db }),
	).rejects.toThrow('Unrecognized column: "unknown_column"');

	const persistedAssessments = await db
		.selectFrom("assessment")
		.select("id")
		.where("projectId", "=", project.rowId)
		.execute();

	expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments blocks the import when a row has no matching submission", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Missing Submitter Project");
	const projectPublicId = project.id;
	const fixture = await createAssessmentFixture(db, project.rowId);
	const missingStudentId = buildTestId("missing-student");

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "true",
		},
		{
			submission_type: "individual",
			submitter: missingStudentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "true",
		},
	];

	await expect(
		saveAssessments({ rows, projectId: projectPublicId }, { db }),
	).rejects.toThrow(
		`No matching individual submission for "${missingStudentId}"`,
	);

	const persistedAssessments = await db
		.selectFrom("assessment")
		.select("id")
		.where("projectId", "=", project.rowId)
		.execute();

	expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments returns imported and overwritten counts", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Overwrite Count Project");
	const projectPublicId = project.id;
	const fixture = await createAssessmentFixture(db, project.rowId);

	const firstImport: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "true",
		},
	];

	await expect(
		saveAssessments({ rows: firstImport, projectId: projectPublicId }, { db }),
	).resolves.toEqual({ assessmentCount: 1, overwriteCount: 0 });

	const secondImport: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "false",
			[`${fixture.questionId}:${fixture.numericalRubricId}`]: "5",
		},
	];

	await expect(
		saveAssessments({ rows: secondImport, projectId: projectPublicId }, { db }),
	).resolves.toEqual({ assessmentCount: 2, overwriteCount: 1 });
});

test("saveAssessments rolls back all writes if a later transactional write fails", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Transactional Rollback Project",
	);
	const projectPublicId = project.id;
	const fixture = await createAssessmentFixture(db, project.rowId);

	// The first row writes a valid boolean assessment; the second row carries a
	// numerical score outside the rubric range. saveAssessments parses both rows
	// before the transaction, so the out-of-range score only fails inside
	// saveAssessmentInDb — after the first write has already happened in the same
	// transaction. A genuine in-transaction failure, no primitive mock required.
	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "true",
		},
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.numericalRubricId}`]: "999",
		},
	];

	await expect(
		saveAssessments({ rows, projectId: projectPublicId }, { db }),
	).rejects.toThrow("Enter a score of at most 10.");

	const persistedAssessments = await db
		.selectFrom("assessment")
		.select("id")
		.where("projectId", "=", project.rowId)
		.execute();

	expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments links assessments only to the target project even when the same student id exists in another project", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Cross-Project Isolation A");
	await using projectB = await createProject(db, "Cross-Project Isolation B");
	const projectBPublicId = projectB.id;

	// The same student external id exists in both projects.
	// Each project has its own question/rubric ids (to avoid saveAssessment
	// ambiguity on shared question text ids, which is a separate concern).
	const sharedStudentId = "shared-student-cross-proj";

	async function buildFixtureInProject(projectId: number) {
		const questionId = buildTestId("question");
		const rubricId = buildTestId("rubric");

		await db
			.insertInto("student")
			.values({
				projectId,
				id: sharedStudentId,
				lastName: "CrossProj",
				firstName: "Student",
			})
			.execute();

		const studentRow = await db
			.selectFrom("student")
			.select("rowId")
			.where("projectId", "=", projectId)
			.where("id", "=", sharedStudentId)
			.executeTakeFirstOrThrow();

		await db
			.insertInto("submission")
			.values({ projectId, type: "individual", studentId: studentRow.rowId })
			.execute();

		await db
			.insertInto("question")
			.values({ projectId, id: questionId, label: "Q", position: 0 })
			.execute();

		const question = await db
			.selectFrom("question")
			.select("rowId")
			.where("projectId", "=", projectId)
			.where("id", "=", questionId)
			.executeTakeFirstOrThrow();

		const rubricRows = await db
			.insertInto("rubric")
			.values({
				id: rubricId,
				projectId,
				questionId: question.rowId,
				type: "boolean",
				position: 0,
				label: "Correct",
			})
			.returning("rowId")
			.execute();

		const rubric = rubricRows[0];
		if (rubric == null) throw new Error("Expected rubric row");

		await db
			.insertInto("booleanRubric")
			.values({ rubricId: rubric.rowId, marks: 1, falseMarks: 0 })
			.execute();

		return { questionId, rubricId };
	}

	// Build fixtures; only capture project B's ids for the import rows
	await buildFixtureInProject(projectA.rowId);
	const { questionId: questionBId, rubricId: rubricBId } =
		await buildFixtureInProject(projectB.rowId);

	// Import assessments targeting project B only using project B's rubric column
	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: sharedStudentId,
			[`${questionBId}:${rubricBId}`]: "true",
		},
	];

	await saveAssessments({ rows, projectId: projectBPublicId }, { db });

	// Project A must have zero assessments
	const projectAAssessments = await db
		.selectFrom("assessment")
		.select("id")
		.where("projectId", "=", projectA.rowId)
		.execute();

	expect(projectAAssessments).toHaveLength(0);

	// Project B must have exactly one assessment
	const projectBAssessments = await db
		.selectFrom("assessment")
		.select("id")
		.where("projectId", "=", projectB.rowId)
		.execute();

	expect(projectBAssessments).toHaveLength(1);
});

test("saveAssessments invalidates the assessment tags after the import commits", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Import Invalidation Project");
	const fixture = await createAssessmentFixture(db, project.rowId);

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "true",
		},
	];

	await saveAssessments({ rows, projectId: project.id }, { db });

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["assessments", "max"],
		["assessments:all", "max"],
	]);
});

test("saveAssessments does not invalidate when the import fails", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Import Failure Project");
	const fixture = await createAssessmentFixture(db, project.rowId);

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.rubricId}`]: "not-a-boolean",
		},
	];

	await expect(
		saveAssessments({ rows, projectId: project.id }, { db }),
	).rejects.toThrow("Assessment import errors:");

	expect(revalidateTag).not.toHaveBeenCalled();
});
