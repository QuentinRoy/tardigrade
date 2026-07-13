import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createGradedBooleanRubricFixture,
	createOrdinalRubricFixture,
} from "#test/rubrics.ts";
import {
	loadRubric,
	loadRubricRows,
	loadRubricRowsFromDb,
	loadRubricsById,
	rubricCacheTags,
} from "./rubrics.ts";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

test("loadRubricRowsFromDb returns only the rows scoped to the given project", async () => {
	await using db = await createTestDb();

	await using project = await createProject(db, "Read Seam Project");
	await using otherProject = await createProject(db, "Read Seam Other Project");
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);
	await createGradedBooleanRubricFixture(db, otherProject.rowId);

	const rows = await loadRubricRowsFromDb(db, { projectId: project.id });

	expect(rows).toEqual([
		{
			id: fixture.rubricId,
			label: "Boolean rubric",
			criteria: [
				{
					id: fixture.criterionId,
					kind: "check",
					description: null,
					label: "Correct",
					checkCriterion: { marks: 2, falseMarks: 0 },
					optionsCriterion: null,
					numberCriterion: null,
				},
			],
		},
	]);
});

test("loadRubricRows wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rows Wrapper Project");
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);

	const rows = await loadRubricRows({ projectId: project.id }, { db });

	expect(rows.map((row) => row.id)).toEqual([fixture.rubricId]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(rubricCacheTags());
});

test("loadRubricsById forwards its db option to the shared loadRubricRows source", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"RubricsById Forwarding Project",
	);
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);

	const rubricsById = await loadRubricsById({ projectId: project.id }, { db });

	expect(Object.keys(rubricsById)).toEqual([fixture.rubricId]);
	expect(
		rubricsById[fixture.rubricId]?.criteria.map((criterion) => criterion.id),
	).toEqual([fixture.criterionId]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(rubricCacheTags());
});

test("loadRubric forwards its db option to the shared loadRubricRows source", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Rubric Forwarding Project");
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);

	const rubric = await loadRubric(
		{ projectId: project.id, rubricId: fixture.rubricId },
		{ db },
	);

	expect(rubric?.criteria.map((criterion) => criterion.id)).toEqual([
		fixture.criterionId,
	]);
});

test("loadRubricRowsFromDb returns optionsCriterion with empty marks when the optionsCriterion row exists but has no optionsCriterionMark rows", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Ordinal Empty Marks Project");

	const { rubricId, criterionId } = await createOrdinalRubricFixture(
		db,
		project.rowId,
	);

	await db
		.deleteFrom("optionsCriterionMark")
		.where(
			"optionsCriterionId",
			"in",
			db
				.selectFrom("optionsCriterion")
				.innerJoin(
					"criterion",
					"criterion.rowId",
					"optionsCriterion.criterionId",
				)
				.where("criterion.id", "=", criterionId)
				.select("optionsCriterion.id"),
		)
		.execute();

	const rows = await loadRubricRowsFromDb(db, { projectId: project.id });

	expect(rows).toEqual([
		{
			id: rubricId,
			label: "Ordinal rubric",
			criteria: [
				{
					id: criterionId,
					kind: "options",
					description: null,
					label: "Ordinal",
					checkCriterion: null,
					optionsCriterion: { marks: [] },
					numberCriterion: null,
				},
			],
		},
	]);
});
