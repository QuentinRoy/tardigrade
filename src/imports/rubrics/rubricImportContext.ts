import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import type { ImportedRubrics } from "#imports/types.ts";
import type { RubricImportContext } from "./prepareRubricImport.ts";

// `db` may be the global client or a caller-supplied transaction. Fetches
// everything prepareRubricImport() needs, driven by the parsed rubrics.
export async function loadRubricImportContextFromDb(
	db: Kysely<DB>,
	{ rubrics, projectId }: { rubrics: ImportedRubrics; projectId: string },
): Promise<RubricImportContext> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const criterionIds = rubrics.flatMap((rubric) =>
		rubric.criteria.map((criterion) => criterion.id),
	);

	if (criterionIds.length === 0) {
		return { existingCriteriaById: new Map() };
	}

	const criterionRows = await db
		.selectFrom("criterion")
		.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
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
			"rubric.id as rubricId",
			fn.count<number>("criterionAssessment.id").as("assessmentCount"),
		])
		.groupBy(["criterion.id", "criterion.kind", "rubric.id"])
		.execute();

	const existingCriteriaById = new Map(
		criterionRows.map((row) => [
			row.id,
			{
				kind: row.kind,
				rubricId: row.rubricId,
				assessmentCount: Number(row.assessmentCount),
			},
		]),
	);

	return { existingCriteriaById };
}
