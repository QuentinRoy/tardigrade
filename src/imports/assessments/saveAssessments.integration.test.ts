import type { Kysely } from "kysely";
import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import type { ImportedAssessmentRow } from "#imports/types.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { saveAssessments } from "./saveAssessments.ts";

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
	criterionId: string;
	numberCriterionId: string;
}> {
	const questionId = buildTestId("question");
	const studentId = buildTestId("student");
	const criterionId = buildTestId("criterion");
	const numberCriterionId = buildTestId("criterion-numerical");

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

	const criterion = await db
		.insertInto("criterion")
		.values({
			id: criterionId,
			projectId,
			questionId: question.rowId,
			kind: "check",
			position: 0,
			label: "Correctness",
		})
		.returning(["id", "rowId"])
		.execute();

	const createdCriterion = criterion[0];

	if (createdCriterion == null) {
		throw new Error("Expected criterion row to be created for fixture setup.");
	}

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: createdCriterion.rowId, marks: 2, falseMarks: 0 })
		.execute();

	const numberCriterion = await db
		.insertInto("criterion")
		.values({
			id: numberCriterionId,
			projectId,
			questionId: question.rowId,
			kind: "number",
			position: 1,
			label: "Score",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: numberCriterion.rowId,
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
		criterionId,
		numberCriterionId,
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
			[`${fixture.questionId}:${fixture.criterionId}`]: "true",
		},
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.criterionId}`]: "not-a-boolean",
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
			[`${fixture.questionId}:${fixture.criterionId}`]: "true",
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
			[`${fixture.questionId}:${fixture.criterionId}`]: "true",
		},
		{
			submission_type: "individual",
			submitter: missingStudentId,
			[`${fixture.questionId}:${fixture.criterionId}`]: "true",
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
			[`${fixture.questionId}:${fixture.criterionId}`]: "true",
		},
	];

	await expect(
		saveAssessments({ rows: firstImport, projectId: projectPublicId }, { db }),
	).resolves.toEqual({ assessmentCount: 1, overwriteCount: 0 });

	const secondImport: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.criterionId}`]: "false",
			[`${fixture.questionId}:${fixture.numberCriterionId}`]: "5",
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
	// numerical score outside the criterion range. saveAssessments parses both rows
	// before the transaction, so the out-of-range score only fails inside
	// saveAssessmentInDb — after the first write has already happened in the same
	// transaction. A genuine in-transaction failure, no primitive mock required.
	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.criterionId}`]: "true",
		},
		{
			submission_type: "individual",
			submitter: fixture.studentId,
			[`${fixture.questionId}:${fixture.numberCriterionId}`]: "999",
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
	// Each project has its own question/criterion ids (to avoid saveAssessment
	// ambiguity on shared question text ids, which is a separate concern).
	const sharedStudentId = "shared-student-cross-proj";

	async function buildFixtureInProject(projectId: number) {
		const questionId = buildTestId("question");
		const criterionId = buildTestId("criterion");

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

		const criterionRows = await db
			.insertInto("criterion")
			.values({
				id: criterionId,
				projectId,
				questionId: question.rowId,
				kind: "check",
				position: 0,
				label: "Correct",
			})
			.returning("rowId")
			.execute();

		const criterion = criterionRows[0];
		if (criterion == null) throw new Error("Expected criterion row");

		await db
			.insertInto("checkCriterion")
			.values({ criterionId: criterion.rowId, marks: 1, falseMarks: 0 })
			.execute();

		return { questionId, criterionId };
	}

	// Build fixtures; only capture project B's ids for the import rows
	await buildFixtureInProject(projectA.rowId);
	const { questionId: questionBId, criterionId: criterionBId } =
		await buildFixtureInProject(projectB.rowId);

	// Import assessments targeting project B only using project B's criterion column
	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: sharedStudentId,
			[`${questionBId}:${criterionBId}`]: "true",
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
			[`${fixture.questionId}:${fixture.criterionId}`]: "true",
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
			[`${fixture.questionId}:${fixture.criterionId}`]: "not-a-boolean",
		},
	];

	await expect(
		saveAssessments({ rows, projectId: project.id }, { db }),
	).rejects.toThrow("Assessment import errors:");

	expect(revalidateTag).not.toHaveBeenCalled();
});
