import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createGradedBooleanRubricFixture,
	createRubric,
} from "#test/rubrics.ts";
import {
	getRubricDefinitionDeleteImpact,
	getRubricDefinitionDeleteImpactFromDb,
	loadRubricDefinitions,
	loadRubricDefinitionsFromDb,
	rubricDefinitionCacheTags,
} from "./rubricDefinitions.ts";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

test("loadRubricDefinitionsFromDb returns scoped definitions with grade counts", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Definition Read Project");
	await using otherProject = await createProject(
		db,
		"Definition Read Other Project",
	);
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);
	await createGradedBooleanRubricFixture(db, otherProject.rowId);

	const definitions = await loadRubricDefinitionsFromDb(db, {
		projectId: project.id,
	});

	expect(definitions).toEqual([
		{
			id: fixture.rubricId,
			position: 0,
			gradedTargetCount: 1,
			rubric: {
				label: "Boolean rubric",
				criteria: [
					{
						id: fixture.criterionId,
						label: "Correct",
						description: undefined,
						kind: "check",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
		},
	]);
});

test("loadRubricDefinitionsFromDb returns zero grade count for ungraded rubrics", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Definition Read Ungraded Project",
	);
	const rubric = await createRubric(db, project.rowId, 0);

	const definitions = await loadRubricDefinitionsFromDb(db, {
		projectId: project.id,
	});

	expect(definitions).toEqual([
		{
			id: rubric.id,
			position: 0,
			gradedTargetCount: 0,
			rubric: { label: "Rubric 0", criteria: [] },
		},
	]);
});

test("getRubricDefinitionDeleteImpactFromDb reports the linked grade count", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Definition Impact Project");
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);

	const impact = await getRubricDefinitionDeleteImpactFromDb(db, {
		rubricId: fixture.rubricId,
		projectId: project.id,
	});

	expect(impact).toEqual({ gradedTargetCount: 1 });
});

test("getRubricDefinitionDeleteImpactFromDb reports zero for an ungraded rubric", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Definition Impact Ungraded Project",
	);
	const rubric = await createRubric(db, project.rowId, 0);

	const impact = await getRubricDefinitionDeleteImpactFromDb(db, {
		rubricId: rubric.id,
		projectId: project.id,
	});

	expect(impact).toEqual({ gradedTargetCount: 0 });
});

test("loadRubricDefinitions wrapper delegates to its primitive through the injected handle", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Definition Wrapper Project");
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);

	const definitions = await loadRubricDefinitions(
		{ projectId: project.id },
		{ db },
	);

	expect(definitions.map((definition) => definition.id)).toEqual([
		fixture.rubricId,
	]);
	expect(definitions[0]?.gradedTargetCount).toBe(1);

	// Includes the nested `loadRubricRows` registration: this scope's own tags
	// plus the full closure of everything it composes (ADR 0008 rule 3).
	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual([...rubricDefinitionCacheTags(), "rubrics"]);
});

test("getRubricDefinitionDeleteImpact wrapper delegates to its primitive through the injected handle", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Impact Wrapper Project");
	const fixture = await createGradedBooleanRubricFixture(db, project.rowId);

	const impact = await getRubricDefinitionDeleteImpact(
		{ rubricId: fixture.rubricId, projectId: project.id },
		{ db },
	);

	expect(impact).toEqual({ gradedTargetCount: 1 });
});
