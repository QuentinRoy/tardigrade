import type { Kysely } from "kysely";
import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
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

async function loadProjectRowId(
	db: Kysely<DB>,
	projectId: string,
): Promise<number> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();

	return project.rowId;
}

async function createStudentAndTarget(
	db: Kysely<DB>,
	projectId: string,
	studentId: string,
): Promise<string> {
	const projectRowId = await loadProjectRowId(db, projectId);

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: studentId,
			lastName: "Isolation",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const [id] = await nextGradeTargetIds(db, { projectRowId, count: 1 });
	if (id == null) throw new Error("Expected a generated id");

	await db
		.insertInto("gradeTarget")
		.values({
			projectId: projectRowId,
			id,
			kind: "individual",
			studentRowId: studentRow.rowId,
		})
		.execute();

	return id;
}

async function createGroupAndTarget(
	db: Kysely<DB>,
	projectId: string,
	groupName: string,
	memberStudentId: string,
): Promise<string> {
	const projectRowId = await loadProjectRowId(db, projectId);

	await db
		.insertInto("group")
		.values({ projectId: projectRowId, name: groupName })
		.execute();

	const group = await db
		.selectFrom("group")
		.select("id")
		.where("projectId", "=", projectRowId)
		.where("name", "=", groupName)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: memberStudentId,
			lastName: "Group",
			firstName: "Member",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", memberStudentId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("studentToGroup")
		.values({ studentId: studentRow.rowId, groupId: group.id })
		.execute();

	const [id] = await nextGradeTargetIds(db, { projectRowId, count: 1 });
	if (id == null) throw new Error("Expected a generated id");

	await db
		.insertInto("gradeTarget")
		.values({
			projectId: projectRowId,
			id,
			kind: "group",
			groupRowId: group.id,
		})
		.execute();

	return id;
}

test("loadGradeTargetsFromDb returns only individual targets for the requested project when student ids collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Isolation Project A");
	await using projectB = await createProject(db, "Isolation Project B");

	const sharedStudentId = "shared-student-iso-001";

	const targetAId = await createStudentAndTarget(
		db,
		projectA.id,
		sharedStudentId,
	);
	const targetBId = await createStudentAndTarget(
		db,
		projectB.id,
		sharedStudentId,
	);

	const { targets: targetsA } = await loadGradeTargetsFromDb(db, {
		projectId: projectA.id,
	});
	const { targets: targetsB } = await loadGradeTargetsFromDb(db, {
		projectId: projectB.id,
	});

	expect(targetsA).toHaveLength(1);
	expect(targetsB).toHaveLength(1);

	const targetA = targetsA[0];
	const targetB = targetsB[0];

	if (targetA == null || targetB == null) throw new Error("Expected targets");

	expect(targetA.id).toBe(targetAId);
	expect(targetB.id).toBe(targetBId);
	// Ids are per-project ordinals, not globally unique — each project's first
	// target is legitimately "t-1" in both, and that collision is expected, not
	// a leak. Isolation is proven above: each project sees only its own row.
	expect(targetA.id).toBe("t-1");
	expect(targetB.id).toBe("t-1");
});

test("loadGradeTargets returns only group targets for the requested project when group names collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Group Isolation A");
	await using projectB = await createProject(db, "Group Isolation B");

	const sharedGroupName = "Shared Group Iso";

	const targetAId = await createGroupAndTarget(
		db,
		projectA.id,
		sharedGroupName,
		"group-member-proj-a",
	);
	const targetBId = await createGroupAndTarget(
		db,
		projectB.id,
		sharedGroupName,
		"group-member-proj-b",
	);

	const { targets: targetsA } = await loadGradeTargetsFromDb(db, {
		projectId: projectA.id,
	});
	const { targets: targetsB } = await loadGradeTargetsFromDb(db, {
		projectId: projectB.id,
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
	// Same per-project-ordinal collision as the individual-target test above.
	expect(targetA.id).toBe("t-1");
	expect(targetB.id).toBe("t-1");
});

test("loadGradeTargets wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Grade Targets Wrapper Project",
	);
	const targetId = await createStudentAndTarget(
		db,
		project.id,
		"wrapper-student-001",
	);

	const targets = await loadGradeTargets({ projectId: project.id }, { db });

	expect(targets.map((target) => target.id)).toEqual([targetId]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(gradeTargetsCacheTags());
});

test("nextGradeTargetIds numbers each project from 1 independently", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Numbering Project A");
	await using projectB = await createProject(db, "Numbering Project B");

	const projectARowId = await loadProjectRowId(db, projectA.id);
	const projectBRowId = await loadProjectRowId(db, projectB.id);

	await createStudentAndTarget(db, projectA.id, "numbering-a-1");
	await createStudentAndTarget(db, projectA.id, "numbering-a-2");

	const nextForA = await nextGradeTargetIds(db, {
		projectRowId: projectARowId,
		count: 2,
	});
	const nextForB = await nextGradeTargetIds(db, {
		projectRowId: projectBRowId,
		count: 2,
	});

	expect(nextForA).toEqual(["t-3", "t-4"]);
	expect(nextForB).toEqual(["t-1", "t-2"]);
});
