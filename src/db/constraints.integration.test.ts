import type { Kysely } from "kysely";
import { expect, test } from "vitest";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import type { DB } from "./generated/db.ts";

type CriterionRowIds = { boolean: number; ordinal: number; numerical: number };

type AssessmentConstraintFixture = {
	optionsCriterionAssessmentIds: { primary: number; secondary: number };
	numberCriterionAssessmentIds: { primary: number; secondary: number };
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

	const rubricId = buildTestId("rubric");

	await db
		.insertInto("rubric")
		.values({
			projectId: projectRowId,
			id: rubricId,
			label: "Constraint rubric",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const insertedCriteria = await db
		.insertInto("criterion")
		.values([
			{
				projectId: projectRowId,
				id: buildTestId("criterion-boolean"),
				rubricId: rubric.rowId,
				kind: "check",
				position: 0,
				label: "Boolean criterion",
			},
			{
				projectId: projectRowId,
				id: buildTestId("criterion-ordinal"),
				rubricId: rubric.rowId,
				kind: "options",
				position: 1,
				label: "Ordinal criterion",
			},
			{
				projectId: projectRowId,
				id: buildTestId("criterion-numerical"),
				rubricId: rubric.rowId,
				kind: "number",
				position: 2,
				label: "Numerical criterion",
			},
		])
		.returning(["id", "rowId", "kind"])
		.execute();

	const criterionRowsByKind = new Map(
		insertedCriteria.map((criterion) => [criterion.kind, criterion.rowId]),
	);

	const checkCriterionId = criterionRowsByKind.get("check");
	const optionsCriterionId = criterionRowsByKind.get("options");
	const numberCriterionId = criterionRowsByKind.get("number");

	if (
		checkCriterionId == null ||
		optionsCriterionId == null ||
		numberCriterionId == null
	) {
		throw new Error("Expected all criterion rows to be created.");
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
				rubricId: rubric.rowId,
			},
			{
				projectId: projectRowId,
				submissionId: secondarySubmission.id,
				rubricId: rubric.rowId,
			},
		])
		.returning("id")
		.execute();

	const [primaryAssessment, secondaryAssessment] = insertedAssessments;

	if (primaryAssessment == null || secondaryAssessment == null) {
		throw new Error("Expected assessment rows to be created.");
	}

	const insertedCriterionAssessments = await db
		.insertInto("criterionAssessment")
		.values([
			{
				assessmentId: primaryAssessment.id,
				criterionId: optionsCriterionId,
				kind: "options",
			},
			{
				assessmentId: secondaryAssessment.id,
				criterionId: optionsCriterionId,
				kind: "options",
			},
			{
				assessmentId: primaryAssessment.id,
				criterionId: numberCriterionId,
				kind: "number",
			},
			{
				assessmentId: secondaryAssessment.id,
				criterionId: numberCriterionId,
				kind: "number",
			},
		])
		.returning(["id", "assessmentId", "kind"])
		.execute();

	const optionsCriterionAssessments = insertedCriterionAssessments.filter(
		(criterionAssessment) => criterionAssessment.kind === "options",
	);

	const numberCriterionAssessments = insertedCriterionAssessments.filter(
		(criterionAssessment) => criterionAssessment.kind === "number",
	);

	const [ordinalPrimary, ordinalSecondary] = optionsCriterionAssessments;
	const [numericalPrimary, numericalSecondary] = numberCriterionAssessments;

	if (
		ordinalPrimary == null ||
		ordinalSecondary == null ||
		numericalPrimary == null ||
		numericalSecondary == null
	) {
		throw new Error(
			"Expected criterion assessment rows for ordinal and numerical criteria.",
		);
	}

	const optionsCriterion = await db
		.insertInto("optionsCriterion")
		.values({ criterionId: optionsCriterionId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("optionsCriterionMark")
		.values([
			{ optionsCriterionId: optionsCriterion.id, label: "A", marks: 4 },
			{ optionsCriterionId: optionsCriterion.id, label: "B", marks: 2 },
		])
		.execute();

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: numberCriterionId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		})
		.execute();

	return {
		optionsCriterionAssessmentIds: {
			primary: ordinalPrimary.id,
			secondary: ordinalSecondary.id,
		},
		numberCriterionAssessmentIds: {
			primary: numericalPrimary.id,
			secondary: numericalSecondary.id,
		},
	};
}

async function createSubtypeConstraintFixture(
	db: Kysely<DB>,
	projectId: string,
): Promise<CriterionRowIds> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const rubricId = buildTestId("rubric-subtype");

	await db
		.insertInto("rubric")
		.values({
			projectId: projectRowId,
			id: rubricId,
			label: "Subtype rubric",
			position: 0,
		})
		.execute();

	const rubric = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", rubricId)
		.executeTakeFirstOrThrow();

	const insertedCriteria = await db
		.insertInto("criterion")
		.values([
			{
				projectId: projectRowId,
				id: buildTestId("subtype-criterion-boolean"),
				rubricId: rubric.rowId,
				kind: "check",
				position: 0,
				label: "Subtype boolean criterion",
			},
			{
				projectId: projectRowId,
				id: buildTestId("subtype-criterion-ordinal"),
				rubricId: rubric.rowId,
				kind: "options",
				position: 1,
				label: "Subtype ordinal criterion",
			},
			{
				projectId: projectRowId,
				id: buildTestId("subtype-criterion-numerical"),
				rubricId: rubric.rowId,
				kind: "number",
				position: 2,
				label: "Subtype numerical criterion",
			},
		])
		.returning(["kind", "rowId"])
		.execute();

	const criterionRowsByKind = new Map(
		insertedCriteria.map((criterion) => [criterion.kind, criterion.rowId]),
	);

	const checkCriterionId = criterionRowsByKind.get("check");
	const optionsCriterionId = criterionRowsByKind.get("options");
	const numberCriterionId = criterionRowsByKind.get("number");

	if (
		checkCriterionId == null ||
		optionsCriterionId == null ||
		numberCriterionId == null
	) {
		throw new Error(
			"Expected all subtype fixture criterion rows to be created.",
		);
	}

	return {
		boolean: checkCriterionId,
		ordinal: optionsCriterionId,
		numerical: numberCriterionId,
	};
}

test("ordinal criterion assessments accept valid labels and roll back failed transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Constraint Ordinal Project");
	const fixture = await createAssessmentConstraintFixture(db, project.id);

	await db
		.insertInto("optionsCriterionAssessment")
		.values({
			criterionAssessmentId: fixture.optionsCriterionAssessmentIds.primary,
			selectedLabel: "A",
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("optionsCriterionAssessment")
				.values({
					criterionAssessmentId:
						fixture.optionsCriterionAssessmentIds.secondary,
					selectedLabel: "B",
				})
				.execute();

			await trx
				.insertInto("optionsCriterionAssessment")
				.values({
					criterionAssessmentId: fixture.optionsCriterionAssessmentIds.primary,
					selectedLabel: "INVALID",
				})
				.execute();
		}),
	).rejects.toThrow("selected_label");

	const persisted = await db
		.selectFrom("optionsCriterionAssessment")
		.select(["criterionAssessmentId", "selectedLabel"])
		.where("criterionAssessmentId", "in", [
			fixture.optionsCriterionAssessmentIds.primary,
			fixture.optionsCriterionAssessmentIds.secondary,
		])
		.orderBy("criterionAssessmentId", "asc")
		.execute();

	expect(persisted).toEqual([
		{
			criterionAssessmentId: fixture.optionsCriterionAssessmentIds.primary,
			selectedLabel: "A",
		},
	]);
});

test("numerical criterion assessments enforce score bounds and roll back failed transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Constraint Numerical Project");
	const fixture = await createAssessmentConstraintFixture(db, project.id);

	await db
		.insertInto("numberCriterionAssessment")
		.values({
			criterionAssessmentId: fixture.numberCriterionAssessmentIds.primary,
			score: 7.5,
		})
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("numberCriterionAssessment")
				.values({
					criterionAssessmentId: fixture.numberCriterionAssessmentIds.secondary,
					score: 4,
				})
				.execute();

			await trx
				.insertInto("numberCriterionAssessment")
				.values({
					criterionAssessmentId: fixture.numberCriterionAssessmentIds.primary,
					score: 11,
				})
				.execute();
		}),
	).rejects.toThrow("out of bounds");

	const persisted = await db
		.selectFrom("numberCriterionAssessment")
		.select(["criterionAssessmentId", "score"])
		.where("criterionAssessmentId", "in", [
			fixture.numberCriterionAssessmentIds.primary,
			fixture.numberCriterionAssessmentIds.secondary,
		])
		.orderBy("criterionAssessmentId", "asc")
		.execute();

	const normalizedPersisted = persisted.map((row) => ({
		criterionAssessmentId: row.criterionAssessmentId,
		score: Number(row.score),
	}));

	expect(normalizedPersisted).toEqual([
		{
			criterionAssessmentId: fixture.numberCriterionAssessmentIds.primary,
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

test("criterion subtype triggers reject mismatched subtype rows and roll back transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Constraint Subtype Project");
	const criterionRowIds = await createSubtypeConstraintFixture(db, project.id);

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: criterionRowIds.boolean, marks: 2, falseMarks: 0 })
		.execute();

	await expect(
		db.transaction().execute(async (trx) => {
			await trx
				.insertInto("optionsCriterion")
				.values({ criterionId: criterionRowIds.ordinal })
				.execute();

			await trx
				.insertInto("checkCriterion")
				.values({
					criterionId: criterionRowIds.ordinal,
					marks: 2,
					falseMarks: 0,
				})
				.execute();
		}),
	).rejects.toThrow("requires Criterion.kind check");

	const booleanRows = await db
		.selectFrom("checkCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.ordinal)
		.execute();

	const ordinalRows = await db
		.selectFrom("optionsCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.ordinal)
		.execute();

	const baselineBooleanRows = await db
		.selectFrom("checkCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.boolean)
		.execute();

	expect(booleanRows).toHaveLength(0);
	expect(ordinalRows).toHaveLength(0);
	expect(baselineBooleanRows).toHaveLength(1);
});

test("numerical criterion score range check rejects a collapsed or inverted range and rolls back transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Constraint Numerical Score Range Project",
	);
	const criterionRowIds = await createSubtypeConstraintFixture(db, project.id);

	await expect(
		db
			.insertInto("numberCriterion")
			.values({
				criterionId: criterionRowIds.numerical,
				minScore: 5,
				maxScore: 5,
				minMarks: 0,
				maxMarks: 10,
				reversed: false,
			})
			.execute(),
	).rejects.toThrow("number_criterion_score_range_check");

	await expect(
		db
			.insertInto("numberCriterion")
			.values({
				criterionId: criterionRowIds.numerical,
				minScore: 10,
				maxScore: 5,
				minMarks: 0,
				maxMarks: 10,
				reversed: false,
			})
			.execute(),
	).rejects.toThrow("number_criterion_score_range_check");

	const persisted = await db
		.selectFrom("numberCriterion")
		.select("criterionId")
		.where("criterionId", "=", criterionRowIds.numerical)
		.execute();

	expect(persisted).toHaveLength(0);
});

test("numerical criterion marks range check rejects inverted marks and rolls back transactional writes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Constraint Numerical Marks Range Project",
	);
	const criterionRowIds = await createSubtypeConstraintFixture(db, project.id);

	await expect(
		db
			.insertInto("numberCriterion")
			.values({
				criterionId: criterionRowIds.numerical,
				minScore: 0,
				maxScore: 10,
				minMarks: 10,
				maxMarks: 0,
				reversed: false,
			})
			.execute(),
	).rejects.toThrow("number_criterion_marks_range_check");

	await db
		.insertInto("numberCriterion")
		.values({
			criterionId: criterionRowIds.numerical,
			minScore: 0,
			maxScore: 10,
			minMarks: 5,
			maxMarks: 5,
			reversed: false,
		})
		.execute();

	const persisted = await db
		.selectFrom("numberCriterion")
		.select(["criterionId", "minMarks", "maxMarks"])
		.where("criterionId", "=", criterionRowIds.numerical)
		.execute();

	const normalizedPersisted = persisted.map((row) => ({
		criterionId: row.criterionId,
		minMarks: Number(row.minMarks),
		maxMarks: Number(row.maxMarks),
	}));

	expect(normalizedPersisted).toEqual([
		{ criterionId: criterionRowIds.numerical, minMarks: 5, maxMarks: 5 },
	]);
});
