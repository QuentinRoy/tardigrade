import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import type { DB } from "./generated/db.ts";

type RubricRowIds = { boolean: number; ordinal: number; numerical: number };

type AssessmentConstraintFixture = {
	ordinalRubricAssessmentIds: { primary: number; secondary: number };
	numericalRubricAssessmentIds: { primary: number; secondary: number };
};

async function createAssessmentConstraintFixture(
	db: Kysely<DB>,
	projectId: string,
): Promise<AssessmentConstraintFixture> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const questionId = buildTestId("question");

	await db
		.insertInto("question")
		.values({
			projectId: projectRowId,
			id: questionId,
			label: "Constraint question",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	const insertedRubrics = await db
		.insertInto("rubric")
		.values([
			{
				projectId: projectRowId,
				id: buildTestId("rubric-boolean"),
				questionId: question.rowId,
				type: "boolean",
				position: 0,
				label: "Boolean rubric",
			},
			{
				projectId: projectRowId,
				id: buildTestId("rubric-ordinal"),
				questionId: question.rowId,
				type: "ordinal",
				position: 1,
				label: "Ordinal rubric",
			},
			{
				projectId: projectRowId,
				id: buildTestId("rubric-numerical"),
				questionId: question.rowId,
				type: "numerical",
				position: 2,
				label: "Numerical rubric",
			},
		])
		.returning(["id", "rowId", "type"])
		.execute();

	const rubricRowsByType = new Map(
		insertedRubrics.map((rubric) => [rubric.type, rubric.rowId]),
	);

	const booleanRubricId = rubricRowsByType.get("boolean");
	const ordinalRubricId = rubricRowsByType.get("ordinal");
	const numericalRubricId = rubricRowsByType.get("numerical");

	if (
		booleanRubricId == null ||
		ordinalRubricId == null ||
		numericalRubricId == null
	) {
		throw new Error("Expected all rubric rows to be created.");
	}

	const studentAId = buildTestId("student-a");
	const studentBId = buildTestId("student-b");

	await db
		.insertInto("student")
		.values([
			{
				projectId: projectRowId,
				id: studentAId,
				firstName: "Primary",
				lastName: "Student",
			},
			{
				projectId: projectRowId,
				id: studentBId,
				firstName: "Secondary",
				lastName: "Student",
			},
		])
		.execute();

	const students = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("projectId", "=", projectRowId)
		.where("id", "in", [studentAId, studentBId])
		.execute();

	const studentRowsById = new Map(
		students.map((student) => [student.id, student]),
	);

	const studentA = studentRowsById.get(studentAId);
	const studentB = studentRowsById.get(studentBId);

	if (studentA == null || studentB == null) {
		throw new Error("Expected student rows to be created.");
	}

	const insertedSubmissions = await db
		.insertInto("submission")
		.values([
			{
				projectId: projectRowId,
				type: "individual",
				studentId: studentA.rowId,
			},
			{
				projectId: projectRowId,
				type: "individual",
				studentId: studentB.rowId,
			},
		])
		.returning("id")
		.execute();

	const [primarySubmission, secondarySubmission] = insertedSubmissions;

	if (primarySubmission == null || secondarySubmission == null) {
		throw new Error("Expected submission rows to be created.");
	}

	const insertedAssessments = await db
		.insertInto("assessment")
		.values([
			{
				projectId: projectRowId,
				submissionId: primarySubmission.id,
				questionId: question.rowId,
			},
			{
				projectId: projectRowId,
				submissionId: secondarySubmission.id,
				questionId: question.rowId,
			},
		])
		.returning("id")
		.execute();

	const [primaryAssessment, secondaryAssessment] = insertedAssessments;

	if (primaryAssessment == null || secondaryAssessment == null) {
		throw new Error("Expected assessment rows to be created.");
	}

	const insertedRubricAssessments = await db
		.insertInto("rubricAssessment")
		.values([
			{
				assessmentId: primaryAssessment.id,
				rubricId: ordinalRubricId,
				type: "ordinal",
			},
			{
				assessmentId: secondaryAssessment.id,
				rubricId: ordinalRubricId,
				type: "ordinal",
			},
			{
				assessmentId: primaryAssessment.id,
				rubricId: numericalRubricId,
				type: "numerical",
			},
			{
				assessmentId: secondaryAssessment.id,
				rubricId: numericalRubricId,
				type: "numerical",
			},
		])
		.returning(["id", "assessmentId", "type"])
		.execute();

	const ordinalRubricAssessments = insertedRubricAssessments.filter(
		(rubricAssessment) => rubricAssessment.type === "ordinal",
	);

	const numericalRubricAssessments = insertedRubricAssessments.filter(
		(rubricAssessment) => rubricAssessment.type === "numerical",
	);

	const [ordinalPrimary, ordinalSecondary] = ordinalRubricAssessments;
	const [numericalPrimary, numericalSecondary] = numericalRubricAssessments;

	if (
		ordinalPrimary == null ||
		ordinalSecondary == null ||
		numericalPrimary == null ||
		numericalSecondary == null
	) {
		throw new Error(
			"Expected rubric assessment rows for ordinal and numerical rubrics.",
		);
	}

	const ordinalRubric = await db
		.insertInto("ordinalRubric")
		.values({ rubricId: ordinalRubricId })
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
			rubricId: numericalRubricId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		})
		.execute();

	return {
		ordinalRubricAssessmentIds: {
			primary: ordinalPrimary.id,
			secondary: ordinalSecondary.id,
		},
		numericalRubricAssessmentIds: {
			primary: numericalPrimary.id,
			secondary: numericalSecondary.id,
		},
	};
}

async function createSubtypeConstraintFixture(
	db: Kysely<DB>,
	projectId: string,
): Promise<RubricRowIds> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const questionId = buildTestId("question-subtype");

	await db
		.insertInto("question")
		.values({
			projectId: projectRowId,
			id: questionId,
			label: "Subtype question",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	const insertedRubrics = await db
		.insertInto("rubric")
		.values([
			{
				projectId: projectRowId,
				id: buildTestId("subtype-rubric-boolean"),
				questionId: question.rowId,
				type: "boolean",
				position: 0,
				label: "Subtype boolean rubric",
			},
			{
				projectId: projectRowId,
				id: buildTestId("subtype-rubric-ordinal"),
				questionId: question.rowId,
				type: "ordinal",
				position: 1,
				label: "Subtype ordinal rubric",
			},
			{
				projectId: projectRowId,
				id: buildTestId("subtype-rubric-numerical"),
				questionId: question.rowId,
				type: "numerical",
				position: 2,
				label: "Subtype numerical rubric",
			},
		])
		.returning(["type", "rowId"])
		.execute();

	const rubricRowsByType = new Map(
		insertedRubrics.map((rubric) => [rubric.type, rubric.rowId]),
	);

	const booleanRubricId = rubricRowsByType.get("boolean");
	const ordinalRubricId = rubricRowsByType.get("ordinal");
	const numericalRubricId = rubricRowsByType.get("numerical");

	if (
		booleanRubricId == null ||
		ordinalRubricId == null ||
		numericalRubricId == null
	) {
		throw new Error("Expected all subtype fixture rubric rows to be created.");
	}

	return {
		boolean: booleanRubricId,
		ordinal: ordinalRubricId,
		numerical: numericalRubricId,
	};
}

test("ordinal rubric assessments accept valid labels and roll back failed transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Constraint Ordinal Project");
	const fixture = await createAssessmentConstraintFixture(db, project.id);

	await db
		.insertInto("ordinalRubricAssessment")
		.values({
			rubricAssessmentId: fixture.ordinalRubricAssessmentIds.primary,
			selectedLabel: "A",
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("ordinalRubricAssessment")
				.values({
					rubricAssessmentId: fixture.ordinalRubricAssessmentIds.secondary,
					selectedLabel: "B",
				})
				.execute();

			await trx
				.insertInto("ordinalRubricAssessment")
				.values({
					rubricAssessmentId: fixture.ordinalRubricAssessmentIds.primary,
					selectedLabel: "INVALID",
				})
				.execute();
		}),
	).rejects.toThrow("selected_label");

	const persisted = await db
		.selectFrom("ordinalRubricAssessment")
		.select(["rubricAssessmentId", "selectedLabel"])
		.where("rubricAssessmentId", "in", [
			fixture.ordinalRubricAssessmentIds.primary,
			fixture.ordinalRubricAssessmentIds.secondary,
		])
		.orderBy("rubricAssessmentId", "asc")
		.execute();

	expect(persisted).toEqual([
		{
			rubricAssessmentId: fixture.ordinalRubricAssessmentIds.primary,
			selectedLabel: "A",
		},
	]);
});

test("numerical rubric assessments enforce score bounds and roll back failed transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Constraint Numerical Project");
	const fixture = await createAssessmentConstraintFixture(db, project.id);

	await db
		.insertInto("numericalRubricAssessment")
		.values({
			rubricAssessmentId: fixture.numericalRubricAssessmentIds.primary,
			score: 7.5,
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("numericalRubricAssessment")
				.values({
					rubricAssessmentId: fixture.numericalRubricAssessmentIds.secondary,
					score: 4,
				})
				.execute();

			await trx
				.insertInto("numericalRubricAssessment")
				.values({
					rubricAssessmentId: fixture.numericalRubricAssessmentIds.primary,
					score: 11,
				})
				.execute();
		}),
	).rejects.toThrow("out of bounds");

	const persisted = await db
		.selectFrom("numericalRubricAssessment")
		.select(["rubricAssessmentId", "score"])
		.where("rubricAssessmentId", "in", [
			fixture.numericalRubricAssessmentIds.primary,
			fixture.numericalRubricAssessmentIds.secondary,
		])
		.orderBy("rubricAssessmentId", "asc")
		.execute();

	const normalizedPersisted = persisted.map((row) => ({
		rubricAssessmentId: row.rubricAssessmentId,
		score: Number(row.score),
	}));

	expect(normalizedPersisted).toEqual([
		{
			rubricAssessmentId: fixture.numericalRubricAssessmentIds.primary,
			score: 7.5,
		},
	]);
});

test("submission owner/type check rejects invalid rows and rolls back transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Constraint Submission Project",
	);

	const studentId = buildTestId("student");

	await db
		.insertInto("student")
		.values({
			projectId: project.rowId,
			id: studentId,
			firstName: "Constraint",
			lastName: "Student",
		})
		.execute();

	const student = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const team = await db
		.insertInto("team")
		.values({ projectId: project.rowId, name: buildTestId("team") })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("submission")
		.values({
			projectId: project.rowId,
			type: "individual",
			studentId: student.rowId,
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("submission")
				.values({ projectId: project.rowId, type: "team", teamId: team.id })
				.execute();

			await trx
				.insertInto("submission")
				.values({
					projectId: project.rowId,
					type: "individual",
					teamId: team.id,
				})
				.execute();
		}),
	).rejects.toThrow("Submission_type_participant_check");

	const persisted = await db
		.selectFrom("submission")
		.select(["id", "type", "studentId", "teamId"])
		.where("projectId", "=", project.rowId)
		.execute();

	expect(persisted).toHaveLength(1);

	const onlySubmission = persisted[0];

	if (onlySubmission == null) {
		throw new Error("Expected one persisted submission after rollback.");
	}

	expect(onlySubmission.type).toBe("individual");
	expect(onlySubmission.studentId).toBe(student.rowId);
	expect(onlySubmission.teamId).toBeNull();
});

test("rubric subtype triggers reject mismatched subtype rows and roll back transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Constraint Subtype Project");
	const rubricRowIds = await createSubtypeConstraintFixture(db, project.id);

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: rubricRowIds.boolean, marks: 2, falseMarks: 0 })
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("ordinalRubric")
				.values({ rubricId: rubricRowIds.ordinal })
				.execute();

			await trx
				.insertInto("booleanRubric")
				.values({ rubricId: rubricRowIds.ordinal, marks: 2, falseMarks: 0 })
				.execute();
		}),
	).rejects.toThrow("requires Rubric.type boolean");

	const booleanRows = await db
		.selectFrom("booleanRubric")
		.select("rubricId")
		.where("rubricId", "=", rubricRowIds.ordinal)
		.execute();

	const ordinalRows = await db
		.selectFrom("ordinalRubric")
		.select("rubricId")
		.where("rubricId", "=", rubricRowIds.ordinal)
		.execute();

	const baselineBooleanRows = await db
		.selectFrom("booleanRubric")
		.select("rubricId")
		.where("rubricId", "=", rubricRowIds.boolean)
		.execute();

	expect(booleanRows).toHaveLength(0);
	expect(ordinalRows).toHaveLength(0);
	expect(baselineBooleanRows).toHaveLength(1);
});
