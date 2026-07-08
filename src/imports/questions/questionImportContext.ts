import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import type { ImportedQuestions } from "#imports/types.ts";
import type { QuestionImportContext } from "./prepareQuestionImport.ts";

// `db` may be the global client or a caller-supplied transaction. Fetches
// everything prepareQuestionImport() needs, driven by the parsed questions.
export async function loadQuestionImportContextFromDb(
	db: Kysely<DB>,
	{ questions, projectId }: { questions: ImportedQuestions; projectId: string },
): Promise<QuestionImportContext> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const criterionIds = questions.flatMap((question) =>
		question.criteria.map((criterion) => criterion.id),
	);

	if (criterionIds.length === 0) {
		return { existingCriteriaById: new Map() };
	}

	const criterionRows = await db
		.selectFrom("criterion")
		.innerJoin("question", "question.rowId", "criterion.questionId")
		.leftJoin(
			"criterionAssessment",
			"criterionAssessment.criterionId",
			"criterion.rowId",
		)
		.where("criterion.projectId", "=", projectRowId)
		.where("criterion.id", "in", criterionIds)
		.select(({ fn }) => [
			"criterion.id",
			"criterion.kind",
			"question.id as questionId",
			fn.count<number>("criterionAssessment.id").as("assessmentCount"),
		])
		.groupBy(["criterion.id", "criterion.kind", "question.id"])
		.execute();

	const existingCriteriaById = new Map(
		criterionRows.map((row) => [
			row.id,
			{
				kind: row.kind,
				questionId: row.questionId,
				assessmentCount: Number(row.assessmentCount),
			},
		]),
	);

	return { existingCriteriaById };
}
