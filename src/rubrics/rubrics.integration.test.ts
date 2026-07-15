import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createGrid } from "#test/grids.ts";
import {
	createGradedCheckRubricFixture,
	createOptionsRubricFixture,
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

test("loadRubricRowsFromDb returns only the rows scoped to the given grid", async () => {
	await using db = await createTestDb();

	await using grid = await createGrid(db, "Read Seam Grid");
	await using otherGrid = await createGrid(db, "Read Seam Other Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);
	await createGradedCheckRubricFixture(db, otherGrid.rowId);

	const rows = await loadRubricRowsFromDb(db, { gridId: grid.id });

	expect(rows).toEqual([
		{
			id: fixture.rubricId,
			label: "Check rubric",
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
	await using grid = await createGrid(db, "Rows Wrapper Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);

	const rows = await loadRubricRows({ gridId: grid.id }, { db });

	expect(rows.map((row) => row.id)).toEqual([fixture.rubricId]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(rubricCacheTags({ gridId: grid.id }));
});

test("loadRubricsById forwards its db option to the shared loadRubricRows source", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "RubricsById Forwarding Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);

	const rubricsById = await loadRubricsById({ gridId: grid.id }, { db });

	expect(Object.keys(rubricsById)).toEqual([fixture.rubricId]);
	expect(
		rubricsById[fixture.rubricId]?.criteria.map((criterion) => criterion.id),
	).toEqual([fixture.criterionId]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(rubricCacheTags({ gridId: grid.id }));
});

test("loadRubric forwards its db option to the shared loadRubricRows source", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Rubric Forwarding Grid");
	const fixture = await createGradedCheckRubricFixture(db, grid.rowId);

	const rubric = await loadRubric(
		{ gridId: grid.id, rubricId: fixture.rubricId },
		{ db },
	);

	expect(rubric?.criteria.map((criterion) => criterion.id)).toEqual([
		fixture.criterionId,
	]);
});

test("loadRubricRowsFromDb returns optionsCriterion with empty marks when the optionsCriterion row exists but has no optionsCriterionMark rows", async () => {
	await using db = await createTestDb();
	await using grid = await createGrid(db, "Options Empty Marks Grid");

	const { rubricId, criterionId } = await createOptionsRubricFixture(
		db,
		grid.rowId,
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

	const rows = await loadRubricRowsFromDb(db, { gridId: grid.id });

	expect(rows).toEqual([
		{
			id: rubricId,
			label: "Options rubric",
			criteria: [
				{
					id: criterionId,
					kind: "options",
					description: null,
					label: "Options",
					checkCriterion: null,
					optionsCriterion: { marks: [] },
					numberCriterion: null,
				},
			],
		},
	]);
});
