import type { Kysely } from "kysely";
import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { saveCriterionGradeInDb } from "#grade-persistence/gradeMutations.ts";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createGradeFixture } from "#test/grades.ts";
import { createProject } from "#test/projects.ts";
import { saveCriterionGrade } from "./gradeMutations.ts";
import { loadRubricGradeFromDb } from "./grades.ts";

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

function assertFound(): never {
	throw new Error("Expected the row written by the race to be present.");
}

async function gradeTargetRowId(
	db: Kysely<Database>,
	targetId: string,
): Promise<number> {
	const row = await db
		.selectFrom("gradeTarget")
		.select("rowId")
		.where("id", "=", targetId)
		.executeTakeFirstOrThrow();

	return row.rowId;
}

test("saveCriterionGradeInDb round-trips boolean, ordinal and numerical grades", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Grade Write Project");
	const fixture = await createGradeFixture(db, project.id);

	const results = await Promise.all([
		saveCriterionGradeInDb(db, {
			projectId: fixture.projectId,
			targetId: fixture.gradeTargetId,
			rubricId: fixture.rubricId,
			grade: {
				criterionId: fixture.criterionIds.boolean,
				kind: "check",
				passed: true,
			},
		}),
		saveCriterionGradeInDb(db, {
			projectId: fixture.projectId,
			targetId: fixture.gradeTargetId,
			rubricId: fixture.rubricId,
			grade: {
				criterionId: fixture.criterionIds.ordinal,
				kind: "options",
				selectedLabel: "B",
			},
		}),
		saveCriterionGradeInDb(db, {
			projectId: fixture.projectId,
			targetId: fixture.gradeTargetId,
			rubricId: fixture.rubricId,
			grade: {
				criterionId: fixture.criterionIds.numerical,
				kind: "number",
				score: 7.5,
			},
		}),
	]);

	expect(results).toEqual([
		{ success: true },
		{ success: true },
		{ success: true },
	]);

	const loaded = await loadRubricGradeFromDb(db, {
		targetId: fixture.gradeTargetId,
		projectId: fixture.projectId,
		rubricId: fixture.rubricId,
	});
	const byCriterionId = new Map(
		loaded.map((value) => [value.criterionId, value]),
	);

	expect(byCriterionId.get(fixture.criterionIds.boolean)).toEqual({
		criterionId: fixture.criterionIds.boolean,
		kind: "check",
		passed: true,
	});
	expect(byCriterionId.get(fixture.criterionIds.ordinal)).toEqual({
		criterionId: fixture.criterionIds.ordinal,
		kind: "options",
		selectedLabel: "B",
	});
	expect(byCriterionId.get(fixture.criterionIds.numerical)).toEqual({
		criterionId: fixture.criterionIds.numerical,
		kind: "number",
		score: 7.5,
	});
});

test("saveCriterionGradeInDb returns a validation error for an invalid ordinal label", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Grade Ordinal Error Project");
	const fixture = await createGradeFixture(db, project.id);

	const result = await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.ordinal,
			kind: "options",
			selectedLabel: "Z",
		},
	});

	expect(result).toEqual({
		success: false,
		error:
			"That option is no longer available. Reload and choose another option.",
	});
});

test("saveCriterionGradeInDb returns a validation error for an out-of-range numerical score", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Grade Numerical Error Project",
	);
	const fixture = await createGradeFixture(db, project.id);

	const result = await saveCriterionGradeInDb(db, {
		projectId: fixture.projectId,
		targetId: fixture.gradeTargetId,
		rubricId: fixture.rubricId,
		grade: {
			criterionId: fixture.criterionIds.numerical,
			kind: "number",
			score: 11,
		},
	});

	expect(result).toEqual({
		success: false,
		error: "Enter a score of at most 10.",
	});
});

test("saveCriterionGradeInDb saves in the correct project when rubric and criterion ids collide", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Grade Collision Project A");
	await using projectB = await createProject(db, "Grade Collision Project B");

	const sharedRubricId = buildTestId("shared-rubric");
	const sharedCriterionIds = {
		boolean: buildTestId("shared-criterion-boolean"),
		ordinal: buildTestId("shared-criterion-ordinal"),
		numerical: buildTestId("shared-criterion-numerical"),
	};

	const fixtureA = await createGradeFixture(db, projectA.id, {
		rubricId: sharedRubricId,
		criterionIds: sharedCriterionIds,
	});
	const fixtureB = await createGradeFixture(db, projectB.id, {
		rubricId: sharedRubricId,
		criterionIds: sharedCriterionIds,
	});

	const result = await saveCriterionGradeInDb(db, {
		projectId: fixtureB.projectId,
		targetId: fixtureB.gradeTargetId,
		rubricId: fixtureB.rubricId,
		grade: {
			criterionId: fixtureB.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	expect(result).toEqual({ success: true });

	const projectBGrade = await loadRubricGradeFromDb(db, {
		targetId: fixtureB.gradeTargetId,
		projectId: fixtureB.projectId,
		rubricId: fixtureB.rubricId,
	});
	expect(projectBGrade).toEqual([
		{ criterionId: fixtureB.criterionIds.boolean, kind: "check", passed: true },
	]);

	const projectAGrade = await loadRubricGradeFromDb(db, {
		targetId: fixtureA.gradeTargetId,
		projectId: fixtureA.projectId,
		rubricId: fixtureA.rubricId,
	});
	expect(projectAGrade).toEqual([]);
});

test("saveCriterionGradeInDb rejects cross-project grade target and rubric combinations", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Grade Isolation Project A");
	await using projectB = await createProject(db, "Grade Isolation Project B");

	const fixtureA = await createGradeFixture(db, projectA.id);
	const fixtureB = await createGradeFixture(db, projectB.id);

	// Project A's own project id, but B's rubric: the rubric lookup is scoped to
	// project A and must not find project B's rubric.
	const result = await saveCriterionGradeInDb(db, {
		projectId: fixtureA.projectId,
		targetId: fixtureA.gradeTargetId,
		rubricId: fixtureB.rubricId,
		grade: {
			criterionId: fixtureB.criterionIds.boolean,
			kind: "check",
			passed: true,
		},
	});

	expect(result).toEqual({
		success: false,
		error:
			"We couldn't match this grade to the selected student work. Reload and try again. If this keeps happening, report this issue.",
	});
});

test("saveCriterionGrade wrapper updates the edited tags read-your-writes and revalidates the derived tags on success", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Grade Save Cache Project");
	const fixture = await createGradeFixture(db, project.id);

	const result = await saveCriterionGrade(
		{
			projectId: fixture.projectId,
			targetId: fixture.gradeTargetId,
			rubricId: fixture.rubricId,
			grade: {
				criterionId: fixture.criterionIds.boolean,
				kind: "check",
				passed: true,
			},
		},
		{ db },
	);

	expect(result).toEqual({ success: true });

	const updatedTags = vi.mocked(updateTag).mock.calls.map((call) => call[0]);
	expect(updatedTags).toEqual([
		`grades:${fixture.gradeTargetId}:${fixture.rubricId}`,
		`grades:${fixture.gradeTargetId}`,
	]);

	const revalidatedTags = vi
		.mocked(revalidateTag)
		.mock.calls.map((call) => call[0]);
	expect(revalidatedTags).toEqual([
		"grades",
		`grades:rubric:${fixture.rubricId}`,
	]);
});

test("saveCriterionGrade wrapper does not invalidate when the save fails validation", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Grade Save Cache Fail Project",
	);
	const fixture = await createGradeFixture(db, project.id);

	const result = await saveCriterionGrade(
		{
			projectId: fixture.projectId,
			targetId: fixture.gradeTargetId,
			rubricId: fixture.rubricId,
			grade: {
				criterionId: fixture.criterionIds.ordinal,
				kind: "options",
				selectedLabel: "Z",
			},
		},
		{ db },
	);

	expect(result.success).toBe(false);
	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidateTag).not.toHaveBeenCalled();
});

// Scenario A: two writers target the same (grade target, criterion).
// Required invariant: exactly one value survives, untorn and unblended. The
// criterion grade's `INSERT ... ON CONFLICT DO NOTHING` makes the second writer
// block on the first writer's uncommitted unique tuple, which is the lock
// `runForcedInterleaving` waits on before letting the first writer commit.
test("saveCriterionGradeInDb keeps a single untorn value when two writers race the same criterion", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Concurrency Same Criterion Project",
	);
	const fixture = await createGradeFixture(db, project.id);

	const { firstResult, secondResult } = await runForcedInterleaving(db, {
		first: (tx) =>
			saveCriterionGradeInDb(tx, {
				projectId: fixture.projectId,
				targetId: fixture.gradeTargetId,
				rubricId: fixture.rubricId,
				grade: {
					criterionId: fixture.criterionIds.boolean,
					kind: "check",
					passed: true,
				},
			}),
		second: (tx) =>
			saveCriterionGradeInDb(tx, {
				projectId: fixture.projectId,
				targetId: fixture.gradeTargetId,
				rubricId: fixture.rubricId,
				grade: {
					criterionId: fixture.criterionIds.boolean,
					kind: "check",
					passed: false,
				},
			}),
	});

	expect(firstResult).toEqual({ success: true });
	expect(secondResult).toEqual({ success: true });

	const targetRowId = await gradeTargetRowId(db, fixture.gradeTargetId);
	const criterionGradeQueryRows = await db
		.selectFrom("criterionGrade")
		.select("id")
		.where("gradeTargetRowId", "=", targetRowId)
		.execute();
	expect(criterionGradeQueryRows).toHaveLength(1);

	const criterionGradeId = criterionGradeQueryRows[0]?.id ?? assertFound();
	const [booleanRows, ordinalRows, numericalRows] = await Promise.all([
		db
			.selectFrom("checkCriterionGrade")
			.select("passed")
			.where("criterionGradeId", "=", criterionGradeId)
			.execute(),
		db
			.selectFrom("optionsCriterionGrade")
			.select("id")
			.where("criterionGradeId", "=", criterionGradeId)
			.execute(),
		db
			.selectFrom("numberCriterionGrade")
			.select("id")
			.where("criterionGradeId", "=", criterionGradeId)
			.execute(),
	]);

	expect(booleanRows).toHaveLength(1);
	expect(ordinalRows).toHaveLength(0);
	expect(numericalRows).toHaveLength(0);
	expect([true, false]).toContain(booleanRows[0]?.passed);

	// Documents current behavior, not a committed policy: the writer that
	// commits last (the second writer, here) wins. This is not a contract a
	// future multi-user concurrency policy is obligated to preserve.
	expect(booleanRows[0]?.passed).toBe(false);
});

// Scenario B: two writers target the same grade target but different criteria —
// the common real race from optimistic-UI saves of several criteria on one
// rubric. Each writer now upserts its own (grade target, criterion) row with no
// shared parent, so the writes touch disjoint tuples and never contend; a plain
// parallel run is enough to prove both criterion grades coexist.
test("saveCriterionGradeInDb keeps both criterion grades when two writers race different criteria on the same rubric", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Concurrency Different Criteria Project",
	);
	const fixture = await createGradeFixture(db, project.id);

	const [firstResult, secondResult] = await Promise.all([
		saveCriterionGradeInDb(db, {
			projectId: fixture.projectId,
			targetId: fixture.gradeTargetId,
			rubricId: fixture.rubricId,
			grade: {
				criterionId: fixture.criterionIds.boolean,
				kind: "check",
				passed: true,
			},
		}),
		saveCriterionGradeInDb(db, {
			projectId: fixture.projectId,
			targetId: fixture.gradeTargetId,
			rubricId: fixture.rubricId,
			grade: {
				criterionId: fixture.criterionIds.ordinal,
				kind: "options",
				selectedLabel: "A",
			},
		}),
	]);

	expect(firstResult).toEqual({ success: true });
	expect(secondResult).toEqual({ success: true });

	const targetRowId = await gradeTargetRowId(db, fixture.gradeTargetId);
	const criterionGradeQueryRows = await db
		.selectFrom("criterionGrade")
		.select("id")
		.where("gradeTargetRowId", "=", targetRowId)
		.execute();
	expect(criterionGradeQueryRows).toHaveLength(2);

	const loaded = await loadRubricGradeFromDb(db, {
		targetId: fixture.gradeTargetId,
		projectId: fixture.projectId,
		rubricId: fixture.rubricId,
	});
	const byCriterionId = new Map(
		loaded.map((value) => [value.criterionId, value]),
	);

	expect(byCriterionId.get(fixture.criterionIds.boolean)).toEqual({
		criterionId: fixture.criterionIds.boolean,
		kind: "check",
		passed: true,
	});
	expect(byCriterionId.get(fixture.criterionIds.ordinal)).toEqual({
		criterionId: fixture.criterionIds.ordinal,
		kind: "options",
		selectedLabel: "A",
	});
});

// Lightweight smoke check on the wrapper, which opens its own transaction per
// call. Naive Promise.all-over-pool parallelism is not the authoritative
// proof (the forced-interleaving tests above are); this just confirms the
// wrapper doesn't error or deadlock under ordinary concurrent usage.
test("saveCriterionGrade wrapper does not error under naive parallel saves", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Concurrency Smoke Project");
	const fixture = await createGradeFixture(db, project.id);

	const results = await Promise.all([
		saveCriterionGrade(
			{
				projectId: fixture.projectId,
				targetId: fixture.gradeTargetId,
				rubricId: fixture.rubricId,
				grade: {
					criterionId: fixture.criterionIds.boolean,
					kind: "check",
					passed: true,
				},
			},
			{ db },
		),
		saveCriterionGrade(
			{
				projectId: fixture.projectId,
				targetId: fixture.gradeTargetId,
				rubricId: fixture.rubricId,
				grade: {
					criterionId: fixture.criterionIds.ordinal,
					kind: "options",
					selectedLabel: "A",
				},
			},
			{ db },
		),
		saveCriterionGrade(
			{
				projectId: fixture.projectId,
				targetId: fixture.gradeTargetId,
				rubricId: fixture.rubricId,
				grade: {
					criterionId: fixture.criterionIds.numerical,
					kind: "number",
					score: 5,
				},
			},
			{ db },
		),
	]);

	expect(results).toEqual([
		{ success: true },
		{ success: true },
		{ success: true },
	]);
});
