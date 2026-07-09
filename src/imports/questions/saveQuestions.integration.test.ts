import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { ImportedQuestions } from "#imports/types.ts";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanQuestionFixture,
	createBooleanQuestionFixture,
} from "#test/questions.ts";
import { prepareQuestionImport } from "./prepareQuestionImport.ts";
import { loadQuestionImportContextFromDb } from "./questionImportContext.ts";
import { saveQuestionImportPlanInDb, saveQuestions } from "./saveQuestions.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

function makeQuestions(params: {
	questionLabel: string;
	criterionLabel: string;
}): ImportedQuestions {
	return [
		{
			id: "q1",
			label: params.questionLabel,
			criteria: [
				{
					id: "r1",
					kind: "check",
					label: params.criterionLabel,
					marks: 2,
					falseMarks: 0,
				},
			],
		},
	];
}

test("saveQuestions allows the same question and criterion ids in different projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Import Project A");
	await using projectB = await createProject(db, "Import Project B");

	const resultA = await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "Question A",
				criterionLabel: "Criterion A",
			}),
			projectId: projectA.id,
		},
		{ db },
	);

	const resultB = await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "Question B",
				criterionLabel: "Criterion B",
			}),
			projectId: projectB.id,
		},
		{ db },
	);

	expect(resultA).toEqual({
		questionCount: 1,
		criterionCount: 1,
		typeChangedCriterionCount: 0,
	});
	expect(resultB).toEqual({
		questionCount: 1,
		criterionCount: 1,
		typeChangedCriterionCount: 0,
	});

	const questions = await db
		.selectFrom("question")
		.select(["projectId", "id", "label"])
		.where("id", "=", "q1")
		.orderBy("projectId", "asc")
		.execute();

	expect(questions).toHaveLength(2);
	expect(questions[0]?.label).toBe("Question A");
	expect(questions[1]?.label).toBe("Question B");

	const criteria = await db
		.selectFrom("criterion")
		.select(["projectId", "id", "label"])
		.where("id", "=", "r1")
		.orderBy("projectId", "asc")
		.execute();

	expect(criteria).toHaveLength(2);
	expect(criteria[0]?.label).toBe("Criterion A");
	expect(criteria[1]?.label).toBe("Criterion B");
});

test("saveQuestions updates only the target project rows", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Isolation Project A");
	await using projectB = await createProject(db, "Isolation Project B");

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "A initial",
				criterionLabel: "A criterion initial",
			}),
			projectId: projectA.id,
		},
		{ db },
	);

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "B initial",
				criterionLabel: "B criterion initial",
			}),
			projectId: projectB.id,
		},
		{ db },
	);

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "A updated",
				criterionLabel: "A criterion updated",
			}),
			projectId: projectA.id,
		},
		{ db },
	);

	const questionA = await db
		.selectFrom("question")
		.select(["label"])
		.where("projectId", "=", projectA.rowId)
		.where("id", "=", "q1")
		.executeTakeFirstOrThrow();

	const questionB = await db
		.selectFrom("question")
		.select(["label"])
		.where("projectId", "=", projectB.rowId)
		.where("id", "=", "q1")
		.executeTakeFirstOrThrow();

	const criterionA = await db
		.selectFrom("criterion")
		.select(["label"])
		.where("projectId", "=", projectA.rowId)
		.where("id", "=", "r1")
		.executeTakeFirstOrThrow();

	const criterionB = await db
		.selectFrom("criterion")
		.select(["label"])
		.where("projectId", "=", projectB.rowId)
		.where("id", "=", "r1")
		.executeTakeFirstOrThrow();

	expect(questionA.label).toBe("A updated");
	expect(questionB.label).toBe("B initial");
	expect(criterionA.label).toBe("A criterion updated");
	expect(criterionB.label).toBe("B criterion initial");
});

test("saveQuestions still upserts duplicate ids within the same project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Single Project Upsert");
	const projectRowId = project.rowId;

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "Before",
				criterionLabel: "Criterion before",
			}),
			projectId: project.id,
		},
		{ db },
	);

	await saveQuestions(
		{
			questions: makeQuestions({
				questionLabel: "After",
				criterionLabel: "Criterion after",
			}),
			projectId: project.id,
		},
		{ db },
	);

	const questions = await db
		.selectFrom("question")
		.select(["id", "label"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", "q1")
		.execute();

	const criteria = await db
		.selectFrom("criterion")
		.select(["id", "label"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", "r1")
		.execute();

	expect(questions).toHaveLength(1);
	expect(criteria).toHaveLength(1);
	expect(questions[0]?.label).toBe("After");
	expect(criteria[0]?.label).toBe("Criterion after");
});

test("saveQuestions blocks a criterion type change when the criterion has linked assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Type Change Blocked Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const questions: ImportedQuestions = [
		{
			id: fixture.questionId,
			label: "Boolean question",
			criteria: [
				{
					id: fixture.criterionId,
					kind: "options",
					label: "Correct",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	await expect(
		saveQuestions({ questions, projectId: project.id }, { db }),
	).rejects.toThrow(
		`Criterion "${fixture.criterionId}" of question "${fixture.questionId}" has 1 linked assessments and cannot change type on import.`,
	);

	const criterion = await db
		.selectFrom("criterion")
		.select("kind")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	expect(criterion.kind).toBe("check");
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("saveQuestions allows a criterion type change when the criterion has no linked assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Type Change Allowed Project");
	const fixture = await createBooleanQuestionFixture(db, project.rowId);

	const questions: ImportedQuestions = [
		{
			id: fixture.questionId,
			label: "Boolean question",
			criteria: [
				{
					id: fixture.criterionId,
					kind: "options",
					label: "Correct",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	const result = await saveQuestions(
		{ questions, projectId: project.id },
		{ db },
	);

	expect(result).toEqual({
		questionCount: 1,
		criterionCount: 1,
		typeChangedCriterionCount: 1,
	});

	const criterion = await db
		.selectFrom("criterion")
		.select("kind")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	expect(criterion.kind).toBe("options");

	const optionsCriterionValues = await db
		.selectFrom("optionsCriterion")
		.innerJoin(
			"optionsCriterionMark",
			"optionsCriterionMark.optionsCriterionId",
			"optionsCriterion.id",
		)
		.innerJoin("criterion", "criterion.rowId", "optionsCriterion.criterionId")
		.select(["optionsCriterionMark.label", "optionsCriterionMark.marks"])
		.where("criterion.id", "=", fixture.criterionId)
		.execute();

	expect(optionsCriterionValues.map((value) => value.label).sort()).toEqual([
		"bad",
		"good",
	]);
});

test("saveQuestions blocks an imported criterion id that already belongs to another question", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Criterion Mismatch Project");
	const fixture = await createBooleanQuestionFixture(db, project.rowId);

	const questions: ImportedQuestions = [
		{
			id: "another-question",
			label: "Another question",
			criteria: [
				{ id: fixture.criterionId, kind: "check", label: "Correct", marks: 2 },
			],
		},
	];

	await expect(
		saveQuestions({ questions, projectId: project.id }, { db }),
	).rejects.toThrow(
		`Criterion "${fixture.criterionId}" already belongs to question "${fixture.questionId}" and cannot be moved to question "another-question" on import.`,
	);

	const criterion = await db
		.selectFrom("criterion")
		.select("questionId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	expect(criterion.questionId).toBe(fixture.questionRowId);
});

test("saveQuestions wrapper invalidates question and assessment tags after the import commits", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Import Questions Cache Project",
	);

	await saveQuestions(
		{
			questions: makeQuestions({ questionLabel: "Q", criterionLabel: "R" }),
			projectId: project.id,
		},
		{ db },
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["questions", "max"],
		["assessments", "max"],
		["assessments:all", "max"],
	]);
});

// Lighter, overlap-invariant coverage (per the plan): assert the row-level
// contract only (no corruption, no thrown error, last-write-wins), not
// reported counts. Targets the criterion delete-then-recreate path on a type
// change (`saveQuestions.ts`), the spot most plausible to misbehave since the
// subtype tables (boolean/ordinal/numerical criterion) must never end up with
// stale rows for the previous type.
test("saveQuestionImportPlanInDb keeps a single criterion definition when two imports race the same criterion type change", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Concurrency Question Import Project",
	);
	const fixture = await createBooleanQuestionFixture(db, project.rowId);

	function makeOrdinalImport(marks: Record<string, number>): ImportedQuestions {
		return [
			{
				id: fixture.questionId,
				label: "Boolean question",
				criteria: [
					{ id: fixture.criterionId, kind: "options", label: "Correct", marks },
				],
			},
		];
	}

	const questionsToMarksAB = makeOrdinalImport({ good: 1, bad: 0 });
	const questionsToMarksXY = makeOrdinalImport({ yes: 2, no: 0 });

	// Both plans are built against the same pre-race snapshot (criterion still
	// boolean, no linked assessments), mirroring two graders importing the
	// same in-flight change before either write lands.
	const [contextAB, contextXY] = await Promise.all([
		loadQuestionImportContextFromDb(db, {
			questions: questionsToMarksAB,
			projectId: project.id,
		}),
		loadQuestionImportContextFromDb(db, {
			questions: questionsToMarksXY,
			projectId: project.id,
		}),
	]);

	const planAB = prepareQuestionImport({
		questions: questionsToMarksAB,
		context: contextAB,
	});
	const planXY = prepareQuestionImport({
		questions: questionsToMarksXY,
		context: contextXY,
	});

	await runForcedInterleaving(db, {
		first: (tx) =>
			saveQuestionImportPlanInDb(tx, { plan: planAB, projectId: project.id }),
		second: (tx) =>
			saveQuestionImportPlanInDb(tx, { plan: planXY, projectId: project.id }),
	});

	const criterionRows = await db
		.selectFrom("criterion")
		.select(["rowId", "kind"])
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.execute();
	expect(criterionRows).toHaveLength(1);
	expect(criterionRows[0]?.kind).toBe("options");
	const criterionRowId = criterionRows[0]?.rowId;

	const [booleanRows, optionsCriterionRows] = await Promise.all([
		db
			.selectFrom("checkCriterion")
			.select("criterionId")
			.where("criterionId", "=", criterionRowId ?? -1)
			.execute(),
		db
			.selectFrom("optionsCriterion")
			.select("id")
			.where("criterionId", "=", criterionRowId ?? -1)
			.execute(),
	]);
	expect(booleanRows).toHaveLength(0);
	expect(optionsCriterionRows).toHaveLength(1);

	const ordinalValues = await db
		.selectFrom("optionsCriterionMark")
		.select("label")
		.where("optionsCriterionId", "=", optionsCriterionRows[0]?.id ?? -1)
		.execute();
	const labels = ordinalValues.map((value) => value.label).sort();

	expect([
		["bad", "good"],
		["no", "yes"],
	]).toContainEqual(labels);

	// Documents current behavior, not a committed policy: the writer that
	// commits last (the second writer, here) wins.
	expect(labels).toEqual(["no", "yes"]);
});
