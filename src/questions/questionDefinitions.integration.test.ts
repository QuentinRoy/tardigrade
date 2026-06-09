import { expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanQuestionFixture,
	createQuestion,
} from "#test/questions.ts";
import {
	getQuestionDefinitionDeleteImpact,
	getQuestionDefinitionDeleteImpactFromDb,
	loadQuestionDefinitions,
	loadQuestionDefinitionsFromDb,
} from "./questionDefinitions.ts";

vi.mock("server-only", () => ({}));

test("loadQuestionDefinitionsFromDb returns scoped definitions with assessment counts", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Definition Read Project");
	await using otherProject = await createProject(
		db,
		"Definition Read Other Project",
	);
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	await createAssessedBooleanQuestionFixture(db, otherProject.rowId);

	const definitions = await loadQuestionDefinitionsFromDb(db, {
		projectId: project.id,
	});

	expect(definitions).toEqual([
		{
			id: fixture.questionId,
			position: 0,
			assessmentCount: 1,
			question: {
				label: "Boolean question",
				rubrics: [
					{
						id: fixture.rubricId,
						label: "Correct",
						description: undefined,
						type: "boolean",
						marks: 2,
						falseMarks: 0,
					},
				],
			},
		},
	]);
});

test("loadQuestionDefinitionsFromDb returns zero assessment count for unassessed questions", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Definition Read Unassessed Project",
	);
	const question = await createQuestion(db, project.rowId, 0);

	const definitions = await loadQuestionDefinitionsFromDb(db, {
		projectId: project.id,
	});

	expect(definitions).toEqual([
		{
			id: question.id,
			position: 0,
			assessmentCount: 0,
			question: { label: "Question 0", rubrics: [] },
		},
	]);
});

test("getQuestionDefinitionDeleteImpactFromDb reports the linked assessment count", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Definition Impact Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const impact = await getQuestionDefinitionDeleteImpactFromDb(db, {
		questionId: fixture.questionId,
		projectId: project.id,
	});

	expect(impact).toEqual({ assessmentCount: 1 });
});

test("getQuestionDefinitionDeleteImpactFromDb reports zero for an unassessed question", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Definition Impact Unassessed Project",
	);
	const question = await createQuestion(db, project.rowId, 0);

	const impact = await getQuestionDefinitionDeleteImpactFromDb(db, {
		questionId: question.id,
		projectId: project.id,
	});

	expect(impact).toEqual({ assessmentCount: 0 });
});

test("loadQuestionDefinitions wrapper delegates to its primitive through the injected handle", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Definition Wrapper Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const definitions = await loadQuestionDefinitions(
		{ projectId: project.id },
		{ db },
	);

	expect(definitions.map((definition) => definition.id)).toEqual([
		fixture.questionId,
	]);
	expect(definitions[0]?.assessmentCount).toBe(1);
});

test("getQuestionDefinitionDeleteImpact wrapper delegates to its primitive through the injected handle", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Impact Wrapper Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);

	const impact = await getQuestionDefinitionDeleteImpact(
		{ questionId: fixture.questionId, projectId: project.id },
		{ db },
	);

	expect(impact).toEqual({ assessmentCount: 1 });
});
