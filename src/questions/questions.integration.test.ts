import { expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	createAssessedBooleanQuestionFixture,
	createOrdinalQuestionFixture,
} from "#test/questions.ts";
import { loadQuestionRowsFromDb } from "./questions.ts";

vi.mock("server-only", () => ({}));

test("loadQuestionRowsFromDb returns only the rows scoped to the given project", async () => {
	await using db = await createTestDb();

	await using project = await createProject(db, "Read Seam Project");
	await using otherProject = await createProject(db, "Read Seam Other Project");
	const fixture = await createAssessedBooleanQuestionFixture(db, project.rowId);
	await createAssessedBooleanQuestionFixture(db, otherProject.rowId);

	const rows = await loadQuestionRowsFromDb(db, { projectId: project.id });

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

test("loadQuestionRowsFromDb returns ordinalRubric with empty marks when the ordinalRubric row exists but has no ordinalRubricValue rows", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Ordinal Empty Marks Project");

	const { questionId, rubricId } = await createOrdinalQuestionFixture(
		db,
		project.rowId,
	);

	await db
		.deleteFrom("ordinalRubricValue")
		.where(
			"ordinalRubricId",
			"in",
			db
				.selectFrom("ordinalRubric")
				.innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
				.where("rubric.id", "=", rubricId)
				.select("ordinalRubric.id"),
		)
		.execute();

	const rows = await loadQuestionRowsFromDb(db, { projectId: project.id });

	expect(rows).toEqual([
		{
			id: questionId,
			label: "Ordinal question",
			rubrics: [
				{
					id: rubricId,
					type: "ordinal",
					description: null,
					label: "Ordinal",
					booleanRubric: null,
					ordinalRubric: { marks: [] },
					numericalRubric: null,
				},
			],
		},
	]);
});
