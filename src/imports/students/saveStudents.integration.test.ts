import type { Kysely } from "kysely";
import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { Database } from "#db/generated/database.ts";
import type { NormalizedImportedGradeTarget } from "#imports/types.ts";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import { prepareStudentImport } from "./prepareStudentImport.ts";
import { saveStudentImportPlanInDb, saveStudents } from "./saveStudents.ts";
import { loadStudentImportContextFromDb } from "./studentImportContext.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

function individualTarget(
	studentId: string,
	lastName = "Shared",
	firstName = "Student",
): NormalizedImportedGradeTarget {
	return {
		id: `target-${studentId}`,
		kind: "individual",
		students: [{ id: studentId, lastName, firstName }],
	};
}

function groupTarget(
	groupName: string,
	students: { id: string; lastName: string; firstName: string }[],
): NormalizedImportedGradeTarget {
	return {
		id: `group-${groupName}`,
		kind: "group",
		group: groupName,
		students,
	};
}

function makeTargets(
	sharedStudentId: string,
	sharedGroupName: string,
): NormalizedImportedGradeTarget[] {
	return [
		individualTarget(sharedStudentId),
		groupTarget(sharedGroupName, [
			{
				id: `${sharedGroupName}-member`,
				lastName: "Group",
				firstName: "Member",
			},
		]),
	];
}

// Loads the member student ids of the grade target a student currently belongs
// to, plus that target's name, from the membership join table.
async function loadTargetForStudent(
	db: Kysely<Database>,
	{ gridRowId, studentId }: { gridRowId: number; studentId: string },
): Promise<{ targetId: string; name: string | null; memberIds: string[] }> {
	const target = await db
		.selectFrom("gradeTargetStudent as gts")
		.innerJoin("gradeTarget as gt", "gt.rowId", "gts.gradeTargetRowId")
		.innerJoin("student", "student.rowId", "gts.studentRowId")
		.where("gt.gridRowId", "=", gridRowId)
		.where("student.id", "=", studentId)
		.select(["gt.rowId as rowId", "gt.id as targetId", "gt.name as name"])
		.executeTakeFirstOrThrow();

	const members = await db
		.selectFrom("gradeTargetStudent as gts")
		.innerJoin("student", "student.rowId", "gts.studentRowId")
		.where("gts.gradeTargetRowId", "=", target.rowId)
		.select("student.id as id")
		.orderBy("student.id", "asc")
		.execute();

	return {
		targetId: target.targetId,
		name: target.name,
		memberIds: members.map((member) => member.id),
	};
}

// Attaches a single check-criterion grade to a target, returning the
// criterion_grade row id so a test can assert whether deleting the target
// cascade-removes the grade.
async function attachCheckGrade(
	db: Kysely<Database>,
	{
		gridRowId,
		gradeTargetRowId,
	}: { gridRowId: number; gradeTargetRowId: number },
): Promise<number> {
	const rubric = await db
		.insertInto("rubric")
		.values({
			gridRowId,
			id: `rubric-${gradeTargetRowId}`,
			label: "Rubric",
			position: 0,
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	const criterion = await db
		.insertInto("criterion")
		.values({
			gridRowId,
			id: `criterion-${gradeTargetRowId}`,
			rubricId: rubric.rowId,
			kind: "check",
			position: 0,
			label: "Criterion",
		})
		.returning("rowId")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterion")
		.values({ criterionId: criterion.rowId, marks: 2 })
		.execute();

	const grade = await db
		.insertInto("criterionGrade")
		.values({ criterionId: criterion.rowId, gradeTargetRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("checkCriterionGrade")
		.values({ criterionGradeId: grade.id, passed: true })
		.execute();

	return grade.id;
}

test("saveStudents keeps imported student ids and group names isolated per grid", async () => {
	await using db = await createTestDb();
	await using gridA = await createGrid(db, "Grid A");
	await using gridB = await createGrid(db, "Grid B");

	const sharedStudentId = "shared-student";
	const sharedGroupName = "Shared Group";

	const resultA = await saveStudents(
		{
			targets: makeTargets(sharedStudentId, sharedGroupName),
			gridId: gridA.id,
		},
		{ db },
	);
	const resultB = await saveStudents(
		{
			targets: makeTargets(sharedStudentId, sharedGroupName),
			gridId: gridB.id,
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

	// The shared student id exists once per grid (distinct rows).
	const studentRows = await db
		.selectFrom("student")
		.select(["id", "rowId", "gridRowId"])
		.where("id", "=", sharedStudentId)
		.execute();
	expect(studentRows).toHaveLength(2);
	expect(new Set(studentRows.map((row) => row.gridRowId)).size).toBe(2);

	// The group target carries its name and its single member in each grid.
	const groupTargets = await db
		.selectFrom("gradeTarget")
		.select(["id", "name", "gridRowId"])
		.where("name", "=", sharedGroupName)
		.execute();
	expect(groupTargets).toHaveLength(2);
	expect(new Set(groupTargets.map((row) => row.gridRowId)).size).toBe(2);

	// The individual target has the student as its sole member, with no name.
	const targetInA = await loadTargetForStudent(db, {
		gridRowId: gridA.rowId,
		studentId: sharedStudentId,
	});
	expect(targetInA.name).toBeNull();
	expect(targetInA.memberIds).toEqual([sharedStudentId]);
});

test("saveStudents classifies re-imported students and grade targets as updated", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Re-import Grid");

	const targets = makeTargets("returning-student", "Returning Group");

	await saveStudents({ targets, gridId: grid.id }, { db });
	const result = await saveStudents({ targets, gridId: grid.id }, { db });

	expect(result).toEqual({
		createdStudentCount: 0,
		updatedStudentCount: 2,
		createdGradeTargetCount: 0,
		updatedGradeTargetCount: 2,
	});

	// The re-import updates in place: one individual target and one group
	// target, not duplicates.
	const targetCount = await db
		.selectFrom("gradeTarget")
		.select((eb) => eb.fn.countAll().as("count"))
		.where("gridRowId", "=", grid.rowId)
		.executeTakeFirstOrThrow();
	expect(Number(targetCount.count)).toBe(2);
});

test("saveStudents replaces a group's membership on re-import", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Membership Replace Grid");

	const firstImport = [
		groupTarget("Team", [
			{ id: "m1", lastName: "One", firstName: "A" },
			{ id: "m2", lastName: "Two", firstName: "B" },
		]),
	];
	await saveStudents({ targets: firstImport, gridId: grid.id }, { db });

	// Re-import the same group with a different membership (m1 stays, m3 joins,
	// m2 leaves into their own individual target so the group is not emptied).
	const secondImport = [
		groupTarget("Team", [
			{ id: "m1", lastName: "One", firstName: "A" },
			{ id: "m3", lastName: "Three", firstName: "C" },
		]),
		individualTarget("m2", "Two", "B"),
	];
	await saveStudents({ targets: secondImport, gridId: grid.id }, { db });

	const team = await loadTargetForStudent(db, {
		gridRowId: grid.rowId,
		studentId: "m1",
	});
	expect(team.name).toBe("Team");
	expect(team.memberIds).toEqual(["m1", "m3"]);

	const solo = await loadTargetForStudent(db, {
		gridRowId: grid.rowId,
		studentId: "m2",
	});
	expect(solo.name).toBeNull();
	expect(solo.memberIds).toEqual(["m2"]);
});

test("saveStudents rejects an import that would leave a named group with no members", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Empty Guard Grid");

	// A two-member group.
	await saveStudents(
		{
			targets: [
				groupTarget("Duo", [
					{ id: "a", lastName: "A", firstName: "A" },
					{ id: "b", lastName: "B", firstName: "B" },
				]),
			],
			gridId: grid.id,
		},
		{ db },
	);

	// Moving both members to individuals would empty the named "Duo" group,
	// which would silently discard the group — refuse it.
	await expect(
		saveStudents(
			{
				targets: [
					individualTarget("a", "A", "A"),
					individualTarget("b", "B", "B"),
				],
				gridId: grid.id,
			},
			{ db },
		),
	).rejects.toThrow(/no members/);

	// The import rolled back: the group and its two members are intact.
	const duo = await loadTargetForStudent(db, {
		gridRowId: grid.rowId,
		studentId: "a",
	});
	expect(duo.name).toBe("Duo");
	expect(duo.memberIds).toEqual(["a", "b"]);
});

test("saveStudents rejects a group target with no students", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Empty Group Grid");

	await expect(
		saveStudents(
			{ targets: [groupTarget("Empty", [])], gridId: grid.id },
			{ db },
		),
	).rejects.toThrow(/no students/);

	const targets = await db
		.selectFrom("gradeTarget")
		.select("id")
		.where("gridRowId", "=", grid.rowId)
		.execute();
	expect(targets).toHaveLength(0);
});

test("saveStudents moving a solo student into a group deletes the vacated individual target and its grades", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Solo To Group Grid");

	// A student graded on their own, then reassigned into a group.
	await saveStudents(
		{ targets: [individualTarget("solo", "Solo", "S")], gridId: grid.id },
		{ db },
	);
	const soloTarget = await loadTargetForStudent(db, {
		gridRowId: grid.rowId,
		studentId: "solo",
	});
	const soloTargetRow = await db
		.selectFrom("gradeTargetStudent as gts")
		.innerJoin("student", "student.rowId", "gts.studentRowId")
		.where("student.gridRowId", "=", grid.rowId)
		.where("student.id", "=", "solo")
		.select("gts.gradeTargetRowId as rowId")
		.executeTakeFirstOrThrow();

	// Grade the solo student on their individual target. Reassignment must drop
	// this grade along with the vacated target (ADR 0014), so the test asserts
	// that destructive consequence rather than only the target's disappearance.
	const gradeId = await attachCheckGrade(db, {
		gridRowId: grid.rowId,
		gradeTargetRowId: soloTargetRow.rowId,
	});

	await saveStudents(
		{
			targets: [
				groupTarget("Team", [
					{ id: "solo", lastName: "Solo", firstName: "S" },
					{ id: "mate", lastName: "Mate", firstName: "M" },
				]),
			],
			gridId: grid.id,
		},
		{ db },
	);

	// The reassignment succeeds: the student is now in the group...
	const teamTarget = await loadTargetForStudent(db, {
		gridRowId: grid.rowId,
		studentId: "solo",
	});
	expect(teamTarget.name).toBe("Team");
	expect(teamTarget.memberIds).toEqual(["mate", "solo"]);

	// ...the vacated individual target is gone, not left empty...
	const remainingTargets = await db
		.selectFrom("gradeTarget")
		.select("id")
		.where("gridRowId", "=", grid.rowId)
		.execute();
	expect(remainingTargets.map((target) => target.id)).not.toContain(
		soloTarget.targetId,
	);
	expect(remainingTargets).toHaveLength(1);

	// ...and the grade attached to it was cascade-deleted with the target.
	const remainingGrades = await db
		.selectFrom("criterionGrade")
		.select("id")
		.where("id", "=", gradeId)
		.execute();
	expect(remainingGrades).toHaveLength(0);
});

test("saveStudents rejects an import that would place a student in two targets", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Partition Guard Grid");

	// The same student appears under two different groups.
	await expect(
		saveStudents(
			{
				targets: [
					groupTarget("Group X", [
						{ id: "dup", lastName: "D", firstName: "D" },
					]),
					groupTarget("Group Y", [
						{ id: "dup", lastName: "D", firstName: "D" },
					]),
				],
				gridId: grid.id,
			},
			{ db },
		),
	).rejects.toThrow(/only one group|belong to only one/);

	// Nothing was imported.
	const targetCount = await db
		.selectFrom("gradeTarget")
		.select((eb) => eb.fn.countAll().as("count"))
		.where("gridRowId", "=", grid.rowId)
		.executeTakeFirstOrThrow();
	expect(Number(targetCount.count)).toBe(0);
});

test("saveStudents wrapper invalidates grade-target and grade tags after the import commits", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Import Students Cache Grid");

	await saveStudents(
		{ targets: makeTargets("student-cache", "Group Cache"), gridId: grid.id },
		{ db },
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		[`grids:${grid.id}:grade-targets`, "max"],
		[`grids:${grid.id}:grades`, "max"],
	]);
});

// A sequential re-import moving a student between groups exercises the
// membership delete-then-reinsert path and its last-write-wins outcome. The
// concurrent version of this race — two imports moving the same student at once
// — is covered by the forced-interleaving test below.
test("saveStudents moving a student to another group leaves a single membership", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Membership Move Grid");

	const mover = { id: "mover", lastName: "Move", firstName: "M" };

	// The student starts in Group B (with a second member so leaving does not
	// empty it), then a re-import moves them into Group C.
	await saveStudents(
		{
			targets: [
				groupTarget("Group B", [
					mover,
					{ id: "stay-b", lastName: "Stay", firstName: "B" },
				]),
			],
			gridId: grid.id,
		},
		{ db },
	);
	await saveStudents(
		{
			targets: [
				groupTarget("Group B", [
					{ id: "stay-b", lastName: "Stay", firstName: "B" },
				]),
				groupTarget("Group C", [
					mover,
					{ id: "stay-c", lastName: "Stay", firstName: "C" },
				]),
			],
			gridId: grid.id,
		},
		{ db },
	);

	const target = await loadTargetForStudent(db, {
		gridRowId: grid.rowId,
		studentId: mover.id,
	});
	expect(target.name).toBe("Group C");
	expect(target.memberIds).toEqual(["mover", "stay-c"]);

	// Exactly one membership row for the mover — no leftover from Group B.
	const moverMemberships = await db
		.selectFrom("gradeTargetStudent as gts")
		.innerJoin("student", "student.rowId", "gts.studentRowId")
		.where("student.gridRowId", "=", grid.rowId)
		.where("student.id", "=", mover.id)
		.select("gts.gradeTargetRowId")
		.execute();
	expect(moverMemberships).toHaveLength(1);
});

// Concurrency contract for two roster imports racing the same student onto
// different groups. The single-column primary key on grade_target_student
// (`student_row_id`) makes two coexisting memberships structurally impossible,
// so the race cannot corrupt into a double membership. It also does not fail:
// because `saveStudentImportPlanInDb` upserts the shared student before touching
// membership, the second writer blocks on that student's row up front and only
// resumes after the first writer has fully committed. Under READ COMMITTED its
// own delete-then-insert then clears the just-committed membership before
// re-inserting, so the outcome is a clean last-write-wins rather than a
// uniqueness conflict. This test pins that: no corruption, exactly one surviving
// membership, and the writer that commits last wins.
test("saveStudents keeps a single membership, last-write-wins, when two imports race the same student onto different groups", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Concurrent Move Grid");

	const racer = { id: "racer", lastName: "Race", firstName: "R" };

	// The racer starts in a committed group (kept non-empty by a second member),
	// then two imports try to move them into different new groups at once.
	await saveStudents(
		{
			targets: [
				groupTarget("Start", [
					racer,
					{ id: "anchor", lastName: "Anchor", firstName: "A" },
				]),
			],
			gridId: grid.id,
		},
		{ db },
	);

	function moveRacerInto(groupName: string): NormalizedImportedGradeTarget[] {
		return [
			groupTarget(groupName, [
				racer,
				{ id: `${groupName}-mate`, lastName: "Mate", firstName: "M" },
			]),
		];
	}

	const targetsToP = moveRacerInto("Group P");
	const targetsToQ = moveRacerInto("Group Q");

	// Both plans are built against the same pre-race snapshot, mirroring two
	// imports that each read the roster before either write lands.
	const [contextP, contextQ] = await Promise.all([
		loadStudentImportContextFromDb(db, {
			targets: targetsToP,
			gridId: grid.id,
		}),
		loadStudentImportContextFromDb(db, {
			targets: targetsToQ,
			gridId: grid.id,
		}),
	]);
	const planP = prepareStudentImport({
		targets: targetsToP,
		context: contextP,
	});
	const planQ = prepareStudentImport({
		targets: targetsToQ,
		context: contextQ,
	});

	// P commits first; Q blocks on the racer's row, then resumes and commits
	// last. Neither writer fails.
	await runForcedInterleaving(db, {
		first: (tx) =>
			saveStudentImportPlanInDb(tx, { plan: planP, gridId: grid.id }),
		second: (tx) =>
			saveStudentImportPlanInDb(tx, { plan: planQ, gridId: grid.id }),
	});

	// No corruption: the racer holds exactly one membership, and last-write-wins
	// leaves them in Q (the writer that committed last).
	const membership = await loadTargetForStudent(db, {
		gridRowId: grid.rowId,
		studentId: racer.id,
	});
	expect(membership.name).toBe("Group Q");
	expect(membership.memberIds).toEqual(["Group Q-mate", "racer"]);

	const racerMemberships = await db
		.selectFrom("gradeTargetStudent as gts")
		.innerJoin("student", "student.rowId", "gts.studentRowId")
		.where("student.gridRowId", "=", grid.rowId)
		.where("student.id", "=", racer.id)
		.select("gts.gradeTargetRowId")
		.execute();
	expect(racerMemberships).toHaveLength(1);
});
