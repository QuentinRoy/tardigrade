import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import {
	assessmentAggregateCacheTag,
	assessmentImportCacheTag,
	assessmentProgressForRubricCacheTag,
	rubricListCacheTag,
} from "#db/cacheTags.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanRubricFixture,
	createOrdinalRubricFixture,
	createRubric,
	getRubricPositions,
} from "#test/rubrics.ts";
import {
	deleteRubricDefinition,
	deleteRubricDefinitionInDb,
	reorderRubrics,
	reorderRubricsInDb,
	saveRubricDefinition,
	saveRubricDefinitionInDb,
} from "./rubricDefinitionMutations.ts";

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

test("saveRubricDefinitionInDb persists inside a caller transaction and rolls back with it", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Rollback Project");
	const rubricId = buildTestId("rubric-primitive");

	await expect(
		db.transaction().execute(async (tx) => {
			await saveRubricDefinitionInDb(tx, {
				input: {
					id: rubricId,
					label: "Inside transaction",
					criteria: [
						{
							id: buildTestId("criterion"),
							kind: "check",
							label: "Correct",
							marks: 2,
							falseMarks: 0,
						},
					],
				},
				projectId: project.id,
			});

			const insideTransaction = await tx
				.selectFrom("rubric")
				.select("id")
				.where("id", "=", rubricId)
				.execute();
			expect(insideTransaction).toHaveLength(1);

			throw new Error("force rollback");
		}),
	).rejects.toThrow("force rollback");

	const afterRollback = await db
		.selectFrom("rubric")
		.select("id")
		.where("id", "=", rubricId)
		.execute();
	expect(afterRollback).toHaveLength(0);
});

test("saveRubricDefinitionInDb renames rubric id while preserving linked assessments", async () => {
	await using db = await createTestDb();
	const { updateTag } = await import("next/cache");
	await using project = await createProject(db, "Save Rename Project");
	const fixture = await createAssessedBooleanRubricFixture(db, project.rowId);
	const renamedRubricId = buildTestId("rubric-renamed");

	const result = await saveRubricDefinitionInDb(db, {
		input: {
			originalId: fixture.rubricId,
			id: renamedRubricId,
			label: "Renamed rubric",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "check",
					label: "Correct",
					marks: 2,
					falseMarks: 0,
				},
			],
		},
		projectId: project.id,
	});

	expect(result.id).toBe(renamedRubricId);
	// A DB Primitive never invalidates cache — that is the wrapper's job.
	expect(updateTag).not.toHaveBeenCalled();

	const rubricRow = await db
		.selectFrom("rubric")
		.select(["id", "rowId"])
		.where("projectId", "=", project.rowId)
		.where("id", "=", renamedRubricId)
		.executeTakeFirstOrThrow();

	expect(rubricRow.rowId).toBe(fixture.rubricRowId);

	// The criterion grade survives the rubric rename, still linked to its
	// criterion (and through it to the renamed rubric).
	const criterionGrade = await db
		.selectFrom("criterionAssessment")
		.select(["id", "criterionId"])
		.where("id", "=", fixture.criterionAssessmentId)
		.executeTakeFirstOrThrow();

	expect(criterionGrade.criterionId).toBe(fixture.criterionRowId);
});

test("saveRubricDefinitionInDb replaces criterion subtype data when criterion type changes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Type Change Project");
	const fixture = await createAssessedBooleanRubricFixture(db, project.rowId);

	const replacedCriterionId = buildTestId("criterion-numerical");

	await saveRubricDefinitionInDb(db, {
		input: {
			originalId: fixture.rubricId,
			id: fixture.rubricId,
			label: "Type-changed rubric",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: replacedCriterionId,
					kind: "number",
					label: "Score",
					minScore: 0,
					maxScore: 10,
					minMarks: 0,
					maxMarks: 5,
					reversed: false,
				},
			],
		},
		projectId: project.id,
	});

	const oldCriterion = await db
		.selectFrom("criterion")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.execute();

	expect(oldCriterion).toHaveLength(0);

	const newCriterion = await db
		.selectFrom("criterion")
		.select(["rowId", "kind"])
		.where("projectId", "=", project.rowId)
		.where("id", "=", replacedCriterionId)
		.executeTakeFirstOrThrow();

	expect(newCriterion.kind).toBe("number");

	const booleanSubtypeRows = await db
		.selectFrom("checkCriterion")
		.select("id")
		.where("criterionId", "=", fixture.criterionRowId)
		.execute();

	const numericalSubtypeRows = await db
		.selectFrom("numberCriterion")
		.select(["criterionId", "minScore", "maxScore"])
		.where("criterionId", "=", newCriterion.rowId)
		.execute();

	const linkedCriterionAssessments = await db
		.selectFrom("criterionAssessment")
		.select("id")
		.where("criterionId", "=", fixture.criterionRowId)
		.execute();

	expect(booleanSubtypeRows).toHaveLength(0);
	expect(numericalSubtypeRows).toHaveLength(1);
	expect(linkedCriterionAssessments).toHaveLength(0);
});

test("saveRubricDefinitionInDb removes stale criteria that are no longer referenced", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Stale Criterion Project");
	const fixture = await createAssessedBooleanRubricFixture(db, project.rowId);

	const staleCriterionId = buildTestId("criterion-stale");

	await saveRubricDefinitionInDb(db, {
		input: {
			originalId: fixture.rubricId,
			id: fixture.rubricId,
			label: "With stale criterion",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "check",
					label: "Primary",
					marks: 2,
					falseMarks: 0,
				},
				{
					id: staleCriterionId,
					kind: "check",
					label: "Temporary",
					marks: 1,
					falseMarks: 0,
				},
			],
		},
		projectId: project.id,
	});

	await saveRubricDefinitionInDb(db, {
		input: {
			originalId: fixture.rubricId,
			id: fixture.rubricId,
			label: "Stale removed",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "check",
					label: "Primary",
					marks: 2,
					falseMarks: 0,
				},
			],
		},
		projectId: project.id,
	});

	const staleCriterionRows = await db
		.selectFrom("criterion")
		.select("id")
		.where("projectId", "=", project.rowId)
		.where("id", "=", staleCriterionId)
		.execute();

	const remainingCriteria = await db
		.selectFrom("criterion")
		.select("id")
		.where("projectId", "=", project.rowId)
		.where("rubricId", "=", fixture.rubricRowId)
		.execute();

	expect(staleCriterionRows).toHaveLength(0);
	expect(remainingCriteria.map((criterion) => criterion.id)).toEqual([
		fixture.criterionId,
	]);
});

test("saveRubricDefinitionInDb replaces ordinal criterion values using the provided label set", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Ordinal Values Project");
	const fixture = await createOrdinalRubricFixture(db, project.rowId);

	await saveRubricDefinitionInDb(db, {
		input: {
			originalId: fixture.rubricId,
			id: fixture.rubricId,
			label: "Ordinal updated",
			criteria: [
				{
					previousId: fixture.criterionId,
					id: fixture.criterionId,
					kind: "options",
					label: "Ordinal",
					marks: { B: 2.5, C: 1 },
				},
			],
		},
		projectId: project.id,
	});

	const criterionRow = await db
		.selectFrom("criterion")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.criterionId)
		.executeTakeFirstOrThrow();

	const optionsCriterion = await db
		.selectFrom("optionsCriterion")
		.select("id")
		.where("criterionId", "=", criterionRow.rowId)
		.executeTakeFirstOrThrow();

	const values = await db
		.selectFrom("optionsCriterionMark")
		.select(["label", "marks"])
		.where("optionsCriterionId", "=", optionsCriterion.id)
		.orderBy("label", "asc")
		.execute();

	const normalizedValues = values.map((value) => ({
		label: value.label,
		marks: Number(value.marks),
	}));

	expect(normalizedValues).toEqual([
		{ label: "B", marks: 2.5 },
		{ label: "C", marks: 1 },
	]);
});

test("deleteRubricDefinitionInDb reports deletion and cascades linked assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Cascade Project");
	const fixture = await createAssessedBooleanRubricFixture(db, project.rowId);

	const result = await deleteRubricDefinitionInDb(db, {
		rubricId: fixture.rubricId,
		projectId: project.id,
	});
	expect(result).toEqual({ deleted: true });

	const rubricRows = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", fixture.rubricId)
		.execute();

	const criterionGradeRows = await db
		.selectFrom("criterionAssessment")
		.select("id")
		.where("id", "=", fixture.criterionAssessmentId)
		.execute();

	expect(rubricRows).toHaveLength(0);
	expect(criterionGradeRows).toHaveLength(0);
});

test("deleteRubricDefinitionInDb returns deleted false when no rubric matches in project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Missing Project");
	const missingId = buildTestId("rubric-missing");

	const result = await deleteRubricDefinitionInDb(db, {
		rubricId: missingId,
		projectId: project.id,
	});

	expect(result).toEqual({ deleted: false });
});

test("deleteRubricDefinitionInDb deletes a rubric that has no assessments", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Standalone Project");
	const rubric = await createRubric(db, project.rowId, 0);

	const result = await deleteRubricDefinitionInDb(db, {
		rubricId: rubric.id,
		projectId: project.id,
	});
	expect(result).toEqual({ deleted: true });

	const rubricRows = await db
		.selectFrom("rubric")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", rubric.id)
		.execute();

	expect(rubricRows).toHaveLength(0);
});

test("reorderRubricsInDb updates positions for the provided rubrics", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Project");
	const first = await createRubric(db, project.rowId, 0);
	const second = await createRubric(db, project.rowId, 1);
	const third = await createRubric(db, project.rowId, 2);

	await reorderRubricsInDb(db, {
		updates: [
			{ id: third.id, position: 0 },
			{ id: first.id, position: 1 },
			{ id: second.id, position: 2 },
		],
		projectId: project.id,
	});

	const positions = await getRubricPositions(db, project.rowId);
	expect(positions).toEqual({ [third.id]: 0, [first.id]: 1, [second.id]: 2 });
});

test("reorderRubricsInDb leaves rubrics outside the update list untouched", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Partial Project");
	const first = await createRubric(db, project.rowId, 0);
	const second = await createRubric(db, project.rowId, 1);
	const untouched = await createRubric(db, project.rowId, 2);

	await reorderRubricsInDb(db, {
		updates: [
			{ id: first.id, position: 1 },
			{ id: second.id, position: 0 },
		],
		projectId: project.id,
	});

	const positions = await getRubricPositions(db, project.rowId);
	expect(positions).toEqual({
		[first.id]: 1,
		[second.id]: 0,
		[untouched.id]: 2,
	});
});

test("reorderRubricsInDb only affects rubrics in the given project", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Scoped Project");
	await using otherProject = await createProject(db, "Reorder Other Project");

	const rubric = await createRubric(db, project.rowId, 0);
	const otherRubric = await createRubric(db, otherProject.rowId, 0);

	await reorderRubricsInDb(db, {
		updates: [{ id: rubric.id, position: 5 }],
		projectId: project.id,
	});

	const positions = await getRubricPositions(db, project.rowId);
	expect(positions).toEqual({ [rubric.id]: 5 });

	const otherPositions = await getRubricPositions(db, otherProject.rowId);
	expect(otherPositions).toEqual({ [otherRubric.id]: 0 });
});

test("reorderRubricsInDb does nothing when given no updates", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Empty Project");
	const rubric = await createRubric(db, project.rowId, 0);

	await reorderRubricsInDb(db, { updates: [], projectId: project.id });

	const positions = await getRubricPositions(db, project.rowId);
	expect(positions).toEqual({ [rubric.id]: 0 });
});

test("reorderRubricsInDb throws and changes nothing when an id is not found", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Missing Project");
	const existing = await createRubric(db, project.rowId, 0);
	const missingId = buildTestId("rubric-missing");

	await expect(
		db.transaction().execute((tx) =>
			reorderRubricsInDb(tx, {
				updates: [
					{ id: existing.id, position: 1 },
					{ id: missingId, position: 0 },
				],
				projectId: project.id,
			}),
		),
	).rejects.toThrow(missingId);

	const positions = await getRubricPositions(db, project.rowId);
	expect(positions).toEqual({ [existing.id]: 0 });
});

test("reorderRubricsInDb throws when the same id is provided more than once", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Duplicate Project");
	const rubric = await createRubric(db, project.rowId, 0);

	await expect(
		reorderRubricsInDb(db, {
			updates: [
				{ id: rubric.id, position: 1 },
				{ id: rubric.id, position: 2 },
			],
			projectId: project.id,
		}),
	).rejects.toThrow(rubric.id);

	const positions = await getRubricPositions(db, project.rowId);
	expect(positions).toEqual({ [rubric.id]: 0 });
});

test("saveRubricDefinition wrapper updates the rubric list read-your-writes and revalidates assessment tags after commit", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Cache Project");
	const rubricId = buildTestId("rubric");

	await saveRubricDefinition(
		{
			input: {
				id: rubricId,
				label: "Cached rubric",
				criteria: [
					{
						id: buildTestId("criterion"),
						kind: "check",
						label: "Correct",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			projectId: project.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([rubricListCacheTag()]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		assessmentAggregateCacheTag(),
		assessmentImportCacheTag(),
		assessmentProgressForRubricCacheTag(rubricId),
	]);
});

test("saveRubricDefinition wrapper revalidates the previous rubric's progress when the id changes", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Rename Cache Project");
	const fixture = await createAssessedBooleanRubricFixture(db, project.rowId);
	const renamedRubricId = buildTestId("rubric-renamed");

	await saveRubricDefinition(
		{
			input: {
				originalId: fixture.rubricId,
				id: renamedRubricId,
				label: "Renamed rubric",
				criteria: [
					{
						previousId: fixture.criterionId,
						id: fixture.criterionId,
						kind: "check",
						label: "Correct",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
			projectId: project.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([rubricListCacheTag()]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		assessmentAggregateCacheTag(),
		assessmentImportCacheTag(),
		assessmentProgressForRubricCacheTag(renamedRubricId),
		assessmentProgressForRubricCacheTag(fixture.rubricId),
	]);
});

test("saveRubricDefinition wrapper does not invalidate when persistence throws", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Save Cache Throw Project");

	await expect(
		saveRubricDefinition(
			{ input: { id: "   ", criteria: [] }, projectId: project.id },
			{ db },
		),
	).rejects.toThrow();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("deleteRubricDefinition wrapper updates the rubric list read-your-writes and revalidates assessment tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Delete Cache Project");
	const rubric = await createRubric(db, project.rowId, 0);

	await deleteRubricDefinition(
		{ rubricId: rubric.id, projectId: project.id },
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([rubricListCacheTag()]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		assessmentAggregateCacheTag(),
		assessmentImportCacheTag(),
		assessmentProgressForRubricCacheTag(rubric.id),
	]);
});

test("reorderRubrics wrapper updates the rubrics tag read-your-writes after commit", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Reorder Cache Project");
	const first = await createRubric(db, project.rowId, 0);
	const second = await createRubric(db, project.rowId, 1);

	await reorderRubrics(
		{
			updates: [
				{ id: first.id, position: 1 },
				{ id: second.id, position: 0 },
			],
			projectId: project.id,
		},
		{ db },
	);

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([rubricListCacheTag()]);
	expect(revalidateTag).not.toHaveBeenCalled();
});
