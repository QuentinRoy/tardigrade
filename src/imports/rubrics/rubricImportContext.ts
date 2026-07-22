import "server-only";
import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { ImportedRubrics } from "#imports/types.ts";
import type { RubricImportContext } from "./prepareRubricImport.ts";

// `db` may be the global client or a caller-supplied transaction. Fetches
// everything prepareRubricImport() needs, driven by the parsed rubrics.
export async function loadRubricImportContextFromDb(
	db: Kysely<Database>,
	{ rubrics, gridId }: { rubrics: ImportedRubrics; gridId: string },
): Promise<RubricImportContext> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = grid.rowId;

	const criterionIds = rubrics.flatMap((rubric) =>
		rubric.criteria.map((criterion) => criterion.id),
	);

	if (criterionIds.length === 0) {
		return { existingCriteriaById: new Map() };
	}

	const criterionRows = await db
		.selectFrom("criterion")
		.innerJoin("rubric", "rubric.rowId", "criterion.rubricRowId")
		.leftJoin(
			"criterionGrade",
			"criterionGrade.criterionRowId",
			"criterion.rowId",
		)
		.where("criterion.gridRowId", "=", gridRowId)
		.where("criterion.id", "in", criterionIds)
		.select(({ fn }) => [
			"criterion.id",
			"criterion.kind",
			"rubric.id as rubricId",
			fn
				.count<number>("criterionGrade.gradeTargetRowId")
				.as("gradedTargetCount"),
		])
		.groupBy(["criterion.id", "criterion.kind", "rubric.id"])
		.execute();

	const existingCriteriaById = new Map(
		criterionRows.map((row) => [
			row.id,
			{
				kind: row.kind,
				rubricId: row.rubricId,
				gradedTargetCount: Number(row.gradedTargetCount),
			},
		]),
	);

	return { existingCriteriaById };
}
