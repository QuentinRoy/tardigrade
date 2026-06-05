import { expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { createAssessedBooleanQuestionFixture } from "#test/questions.ts";
import { loadQuestionRowsFromDb } from "./questions.ts";

vi.mock("server-only", () => ({}));

test("loadQuestionRowsFromDb returns only the rows scoped to the given project", async () => {
	await using db = await createTestDb();

	await using project = await createProject(db, "Read Seam Project");
	await using otherProject = await createProject(db, "Read Seam Other Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	await createAssessedBooleanQuestionFixture(db, otherProject.rowId);

	const rows = await loadQuestionRowsFromDb(db, project.id);

	expect(rows).toEqual([
		{
			id: fixture.questionId,
			label: "Boolean question",
			rubrics: [
				{
					id: fixture.rubricId,
					type: "boolean",
					description: null,
					label: "Correct",
					booleanRubric: { marks: 2, falseMarks: 0 },
					ordinalRubric: null,
					numericalRubric: null,
				},
			],
		},
	]);
});
