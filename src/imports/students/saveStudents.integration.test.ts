import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { NormalizedImportedGradeTarget } from "#imports/types.ts";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { prepareStudentImport } from "./prepareStudentImport.ts";
import { saveStudentImportPlanInDb, saveStudents } from "./saveStudents.ts";
import { loadStudentImportContextFromDb } from "./studentImportContext.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

function makeTargets(
	sharedStudentId: string,
	sharedGroupName: string,
): NormalizedImportedGradeTarget[] {
	return [
		{
			id: `target-${sharedStudentId}`,
			kind: "individual",
			students: [
				{ id: sharedStudentId, lastName: "Shared", firstName: "Student" },
			],
		},
		{
			id: `target-${sharedGroupName}`,
			kind: "group",
			group: sharedGroupName,
			students: [
				{
					id: `${sharedGroupName}-member`,
					lastName: "Group",
					firstName: "Member",
				},
			],
		},
	];
}

test("saveStudents keeps imported student ids and group names isolated per project", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Project A");
	await using projectB = await createProject(db, "Project B");

	const sharedStudentId = "shared-student";
	const sharedGroupName = "Shared Group";

	const resultA = await saveStudents(
		{
			targets: makeTargets(sharedStudentId, sharedGroupName),
			projectId: projectA.id,
		},
		{ db },
	);
	const resultB = await saveStudents(
		{
			targets: makeTargets(sharedStudentId, sharedGroupName),
			projectId: projectB.id,
		},
		{ db },
	);

	expect(resultA).toEqual({
		createdStudentCount: 2,
		updatedStudentCount: 0,
		createdGradeTargetCount: 2,
		updatedGradeTargetCount: 0,
	});
	expect(resultB).toEqual({
		createdStudentCount: 2,
		updatedStudentCount: 0,
		createdGradeTargetCount: 2,
		updatedGradeTargetCount: 0,
	});

	const studentRows = await db
		.selectFrom("student")
		.select(["id", "rowId", "projectId"])
		.where("id", "in", [sharedStudentId, `${sharedGroupName}-member`])
		.orderBy("projectId", "asc")
		.orderBy("id", "asc")
		.execute();

	expect(studentRows).toHaveLength(4);
	expect(
		studentRows
			.filter((row) => row.id === sharedStudentId)
			.map((row) => row.rowId),
	).toHaveLength(2);
	expect(
		new Set(
			studentRows
				.filter((row) => row.id === sharedStudentId)
				.map((row) => row.rowId),
		).size,
	).toBe(2);

	const groupRows = await db
		.selectFrom("group")
		.select(["id", "name", "projectId"])
		.where("name", "=", sharedGroupName)
		.orderBy("projectId", "asc")
		.execute();

	expect(groupRows).toHaveLength(2);
	expect(new Set(groupRows.map((row) => row.projectId)).size).toBe(2);

	const individualTargets = await db
		.selectFrom("gradeTarget")
		.innerJoin("student", "student.rowId", "gradeTarget.studentRowId")
		.select([
			"gradeTarget.id as targetId",
			"gradeTarget.projectId as projectId",
			"student.id as studentId",
			"student.rowId as studentRowId",
		])
		.where("gradeTarget.kind", "=", "individual")
		.orderBy("gradeTarget.projectId", "asc")
		.execute();

	expect(individualTargets).toHaveLength(2);
	expect(individualTargets.map((row) => row.studentId)).toEqual([
		sharedStudentId,
		sharedStudentId,
	]);
	expect(new Set(individualTargets.map((row) => row.studentRowId)).size).toBe(
		2,
	);
});

test("saveStudents classifies re-imported students and grade targets as updated", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Re-import Project");

	const targets = makeTargets("returning-student", "Returning Group");

	await saveStudents({ targets, projectId: project.id }, { db });
	const result = await saveStudents({ targets, projectId: project.id }, { db });

	expect(result).toEqual({
		createdStudentCount: 0,
		updatedStudentCount: 2,
		createdGradeTargetCount: 0,
		updatedGradeTargetCount: 2,
	});
});

test("saveStudents wrapper invalidates grade-target and grade tags after the import commits", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Import Students Cache Project",
	);

	await saveStudents(
		{
			targets: makeTargets("student-cache", "Group Cache"),
			projectId: project.id,
		},
		{ db },
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["grade-targets", "max"],
		["grades", "max"],
		["grades:all", "max"],
	]);
});

// Lighter, overlap-invariant coverage (per the plan): assert the row-level
// contract only (no corruption, no thrown error, last-write-wins), not
// reported counts, which are allowed to drift under concurrent imports.
// Targets the `studentToGroup` delete-then-reinsert path
// (`saveStudents.ts:150`), the spot most plausible to misbehave under
// overlapping writes since it spans a delete and an insert on the same row.
test("saveStudentImportPlanInDb keeps a single group membership when two imports race the same student onto different groups", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Concurrency Student Import Project",
	);

	const sharedStudentId = "shared-student";

	function makeMoveToGroup(groupName: string): NormalizedImportedGradeTarget[] {
		return [
			{
				id: `target-${groupName}`,
				kind: "group",
				group: groupName,
				students: [
					{ id: sharedStudentId, lastName: "Shared", firstName: "Student" },
				],
			},
		];
	}

	const targetsToGroupB = makeMoveToGroup("Group B");
	const targetsToGroupC = makeMoveToGroup("Group C");

	const [contextB, contextC] = await Promise.all([
		loadStudentImportContextFromDb(db, {
			targets: targetsToGroupB,
			projectId: project.id,
		}),
		loadStudentImportContextFromDb(db, {
			targets: targetsToGroupC,
			projectId: project.id,
		}),
	]);

	const planB = prepareStudentImport({
		targets: targetsToGroupB,
		context: contextB,
	});
	const planC = prepareStudentImport({
		targets: targetsToGroupC,
		context: contextC,
	});

	await runForcedInterleaving(db, {
		first: (tx) =>
			saveStudentImportPlanInDb(tx, { plan: planB, projectId: project.id }),
		second: (tx) =>
			saveStudentImportPlanInDb(tx, { plan: planC, projectId: project.id }),
	});

	const studentRows = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", sharedStudentId)
		.execute();
	expect(studentRows).toHaveLength(1);
	const studentRowId = studentRows[0]?.rowId;

	const groupMemberships = await db
		.selectFrom("studentToGroup")
		.innerJoin("group", "group.id", "studentToGroup.groupId")
		.select("group.name")
		.where("studentToGroup.studentId", "=", studentRowId ?? -1)
		.execute();

	expect(groupMemberships).toHaveLength(1);
	expect(["Group B", "Group C"]).toContain(groupMemberships[0]?.name);

	// Documents current behavior, not a committed policy: the writer that
	// commits last (the second writer, here) wins.
	expect(groupMemberships[0]?.name).toBe("Group C");
});
