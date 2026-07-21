import type { Kysely } from "kysely";
import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { Database } from "#db/generated/database.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import {
	gradeTargetsCacheTags,
	loadGradeTargets,
	loadGradeTargetsFromDb,
	nextGradeTargetIds,
} from "./gradeTargets.ts";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

async function loadGridRowId(
	db: Kysely<Database>,
	gridId: string,
): Promise<number> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();

	return grid.rowId;
}

async function insertStudent(
	db: Kysely<Database>,
	{
		gridRowId,
		id,
		lastName,
		firstName,
	}: { gridRowId: number; id: string; lastName: string; firstName: string },
): Promise<number> {
	const student = await db
		.insertInto("student")
		.values({ gridRowId, id, lastName, firstName })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	return student.rowId;
}

// Creates a grade target with the given (optional) name and student members,
// mirroring how the import writes them: a name-less single-member target reads
// as an Individual, everything else as a Group.
async function createTarget(
	db: Kysely<Database>,
	{
		gridRowId,
		name = null,
		studentRowIds,
	}: { gridRowId: number; name?: string | null; studentRowIds: number[] },
): Promise<string> {
	const [id] = await nextGradeTargetIds(db, { gridRowId, count: 1 });
	if (id == null) throw new Error("Expected a generated id");

	const target = await db
		.insertInto("gradeTarget")
		.values({ gridRowId, id, name })
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("gradeTargetStudent")
		.values(
			studentRowIds.map((studentRowId) => ({
				gradeTargetRowId: target.rowId,
				studentRowId,
			})),
		)
		.execute();

	return id;
}

async function createStudentAndTarget(
	db: Kysely<Database>,
	gridId: string,
	studentId: string,
): Promise<string> {
	const gridRowId = await loadGridRowId(db, gridId);
	const studentRowId = await insertStudent(db, {
		gridRowId,
		id: studentId,
		lastName: "Isolation",
		firstName: "Test",
	});

	return createTarget(db, { gridRowId, studentRowIds: [studentRowId] });
}

async function createGroupAndTarget(
	db: Kysely<Database>,
	gridId: string,
	groupName: string,
	memberStudentId: string,
): Promise<string> {
	const gridRowId = await loadGridRowId(db, gridId);
	const studentRowId = await insertStudent(db, {
		gridRowId,
		id: memberStudentId,
		lastName: "Group",
		firstName: "Member",
	});

	return createTarget(db, {
		gridRowId,
		name: groupName,
		studentRowIds: [studentRowId],
	});
}

test("loadGradeTargetsFromDb returns only individual targets for the requested grid when student ids collide across grids", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Isolation Grid A");
	await using gridB = await createGrid(db, "Isolation Grid B");

	const sharedStudentId = "shared-student-iso-001";

	const targetAId = await createStudentAndTarget(db, gridA.id, sharedStudentId);
	const targetBId = await createStudentAndTarget(db, gridB.id, sharedStudentId);

	const { targets: targetsA } = await loadGradeTargetsFromDb(db, {
		gridId: gridA.id,
	});
	const { targets: targetsB } = await loadGradeTargetsFromDb(db, {
		gridId: gridB.id,
	});

	expect(targetsA).toHaveLength(1);
	expect(targetsB).toHaveLength(1);

	const targetA = targetsA[0];
	const targetB = targetsB[0];

	if (targetA == null || targetB == null) throw new Error("Expected targets");

	expect(targetA.id).toBe(targetAId);
	expect(targetB.id).toBe(targetBId);
	// Ids are per-grid ordinals, not globally unique — each grid's first
	// target is legitimately "t-1" in both, and that collision is expected, not
	// a leak. Isolation is proven above: each grid sees only its own row.
	expect(targetA.id).toBe("t-1");
	expect(targetB.id).toBe("t-1");
});

test("loadGradeTargets returns only group targets for the requested grid when group names collide across grids", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Group Isolation A");
	await using gridB = await createGrid(db, "Group Isolation B");

	const sharedGroupName = "Shared Group Iso";

	const targetAId = await createGroupAndTarget(
		db,
		gridA.id,
		sharedGroupName,
		"group-member-proj-a",
	);
	const targetBId = await createGroupAndTarget(
		db,
		gridB.id,
		sharedGroupName,
		"group-member-proj-b",
	);

	const targetsA = await loadGradeTargets({ gridId: gridA.id }, { db });
	const targetsB = await loadGradeTargets({ gridId: gridB.id }, { db });

	expect(targetsA).toHaveLength(1);
	expect(targetsB).toHaveLength(1);

	const targetA = targetsA[0];
	const targetB = targetsB[0];

	if (targetA == null || targetB == null) throw new Error("Expected targets");

	expect(targetA.kind).toBe("group");
	expect(targetA.id).toBe(targetAId);
	expect(targetB.kind).toBe("group");
	expect(targetB.id).toBe(targetBId);
	// Same per-grid-ordinal collision as the individual-target test above.
	expect(targetA.id).toBe("t-1");
	expect(targetB.id).toBe("t-1");
});

test("loadGradeTargets derives individual vs group by the name-OR-multimember rule", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Derivation Grid");
	const gridRowId = await loadGridRowId(db, grid.id);

	const solo = await insertStudent(db, {
		gridRowId,
		id: "solo",
		lastName: "Solo",
		firstName: "Alice",
	});
	const pairFirst = await insertStudent(db, {
		gridRowId,
		id: "pair-1",
		lastName: "Adams",
		firstName: "Bob",
	});
	const pairSecond = await insertStudent(db, {
		gridRowId,
		id: "pair-2",
		lastName: "Baker",
		firstName: "Carol",
	});
	const named = await insertStudent(db, {
		gridRowId,
		id: "named",
		lastName: "Named",
		firstName: "Dan",
	});

	// Unnamed single member -> Individual, labelled with the student's name.
	const individualId = await createTarget(db, {
		gridRowId,
		studentRowIds: [solo],
	});
	// Unnamed multi-member -> Group, labelled with joined member names.
	const unnamedGroupId = await createTarget(db, {
		gridRowId,
		studentRowIds: [pairFirst, pairSecond],
	});
	// Named one member -> Group, honouring the naming intent.
	const namedGroupId = await createTarget(db, {
		gridRowId,
		name: "Lonely Binome",
		studentRowIds: [named],
	});

	const targets = await loadGradeTargets({ gridId: grid.id }, { db });
	const byId = new Map(targets.map((target) => [target.id, target]));

	const individual = byId.get(individualId);
	expect(individual?.kind).toBe("individual");
	expect(individual?.displayLabel).toBe("Solo Alice");
	expect(individual?.memberNames).toEqual([]);

	const unnamedGroup = byId.get(unnamedGroupId);
	expect(unnamedGroup?.kind).toBe("group");
	expect(unnamedGroup?.displayLabel).toBe("Adams Bob, Baker Carol");
	expect(unnamedGroup?.memberNames).toEqual(["Adams Bob", "Baker Carol"]);

	const namedGroup = byId.get(namedGroupId);
	expect(namedGroup?.kind).toBe("group");
	expect(namedGroup?.displayLabel).toBe("Lonely Binome");
	expect(namedGroup?.memberNames).toEqual(["Named Dan"]);
});

test("loadGradeTargets wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Grade Targets Wrapper Grid");
	const targetId = await createStudentAndTarget(
		db,
		grid.id,
		"wrapper-student-001",
	);

	const targets = await loadGradeTargets({ gridId: grid.id }, { db });

	expect(targets.map((target) => target.id)).toEqual([targetId]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(gradeTargetsCacheTags({ gridId: grid.id }));
});

test("nextGradeTargetIds numbers each grid from 1 independently", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Numbering Grid A");
	await using gridB = await createGrid(db, "Numbering Grid B");

	const gridARowId = await loadGridRowId(db, gridA.id);
	const gridBRowId = await loadGridRowId(db, gridB.id);

	await createStudentAndTarget(db, gridA.id, "numbering-a-1");
	await createStudentAndTarget(db, gridA.id, "numbering-a-2");

	const nextForA = await nextGradeTargetIds(db, {
		gridRowId: gridARowId,
		count: 2,
	});
	const nextForB = await nextGradeTargetIds(db, {
		gridRowId: gridBRowId,
		count: 2,
	});

	expect(nextForA).toEqual(["t-3", "t-4"]);
	expect(nextForB).toEqual(["t-1", "t-2"]);
});
