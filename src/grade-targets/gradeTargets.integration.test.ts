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

async function createStudentAndTarget(
	db: Kysely<Database>,
	gridId: string,
	studentId: string,
): Promise<string> {
	const gridRowId = await loadGridRowId(db, gridId);

	await db
		.insertInto("student")
		.values({
			gridRowId: gridRowId,
			id: studentId,
			lastName: "Isolation",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const [id] = await nextGradeTargetIds(db, { gridRowId, count: 1 });
	if (id == null) throw new Error("Expected a generated id");

	await db
		.insertInto("gradeTarget")
		.values({
			gridRowId: gridRowId,
			id,
			kind: "individual",
			studentRowId: studentRow.rowId,
		})
		.execute();

	return id;
}

async function createGroupAndTarget(
	db: Kysely<Database>,
	gridId: string,
	groupName: string,
	memberStudentId: string,
): Promise<string> {
	const gridRowId = await loadGridRowId(db, gridId);

	await db
		.insertInto("group")
		.values({ gridRowId: gridRowId, name: groupName })
		.execute();

	const group = await db
		.selectFrom("group")
		.select("id")
		.where("gridRowId", "=", gridRowId)
		.where("name", "=", groupName)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("student")
		.values({
			gridRowId: gridRowId,
			id: memberStudentId,
			lastName: "Group",
			firstName: "Member",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("gridRowId", "=", gridRowId)
		.where("id", "=", memberStudentId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("studentToGroup")
		.values({ studentId: studentRow.rowId, groupId: group.id })
		.execute();

	const [id] = await nextGradeTargetIds(db, { gridRowId, count: 1 });
	if (id == null) throw new Error("Expected a generated id");

	await db
		.insertInto("gradeTarget")
		.values({ gridRowId: gridRowId, id, kind: "group", groupRowId: group.id })
		.execute();

	return id;
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

	expect(targetA.kind).toBe("group");
	expect(targetA.id).toBe(targetAId);
	expect(targetB.kind).toBe("group");
	expect(targetB.id).toBe(targetBId);
	// Same per-grid-ordinal collision as the individual-target test above.
	expect(targetA.id).toBe("t-1");
	expect(targetB.id).toBe("t-1");
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
