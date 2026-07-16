import "server-only";
import type { Kysely } from "kysely";
import { saveCriterionSubtypesInDb } from "#criteria/criterionSubtypePersistence.ts";
import { invalidateRubricImport } from "#db/cacheInvalidation.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { ImportBlockedError } from "#imports/importErrors.ts";
import type { ImportedRubrics } from "#imports/types.ts";
import {
	prepareRubricImport,
	type RubricImportBlockingDiagnostic,
	type RubricImportPlan,
} from "./prepareRubricImport.ts";
import { loadRubricImportContextFromDb } from "./rubricImportContext.ts";

function formatBlockingDiagnostic(
	diagnostic: RubricImportBlockingDiagnostic,
): string {
	switch (diagnostic.kind) {
		case "criterion-kind-change-blocked": {
			return `Criterion "${diagnostic.criterionId}" of rubric "${diagnostic.rubricId}" has ${diagnostic.gradedTargetCount} linked grades and cannot change kind on import. Edit it in rubric management instead.`;
		}
		case "criterion-rubric-mismatch": {
			return `Criterion "${diagnostic.criterionId}" already belongs to rubric "${diagnostic.existingRubricId}" and cannot be moved to rubric "${diagnostic.importRubricId}" on import.`;
		}
	}
}

function rubricImportBlockedError(
	blockingDiagnostics: RubricImportBlockingDiagnostic[],
): ImportBlockedError {
	const lines = blockingDiagnostics.map(formatBlockingDiagnostic);

	return new ImportBlockedError(
		`Rubric import errors:\n${lines.join("\n")}\nNothing was imported. Fix the listed issues and retry.`,
	);
}

// `db` may be the global client or a caller-supplied transaction. Executes a
// plan's writes; never opens a transaction and never invalidates cache.
export async function saveRubricImportPlanInDb(
	db: Kysely<Database>,
	{ plan, gridId }: { plan: RubricImportPlan; gridId: string },
): Promise<{ rubricCount: number; criterionCount: number }> {
	const rubrics: ImportedRubrics = plan.writes;

	const rubricsById = rubrics.map((rubric, position) => ({
		id: rubric.id,
		label: rubric.label ?? null,
		position,
	}));

	const criterionSources = rubrics.flatMap((rubric) =>
		rubric.criteria.map((criterion, position) => ({
			id: criterion.id,
			rubricId: rubric.id,
			position,
			description: criterion.description ?? null,
			label: criterion.label ?? null,
			kind: criterion.kind,
		})),
	);

	const rubricIds = rubricsById.map((rubric) => rubric.id);
	const criterionIds = criterionSources.map((criterion) => criterion.id);

	const gridRow = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = gridRow.rowId;

	// Criteria whose kind changed (no linked grades, per the prepared plan)
	// are deleted and recreated so subtype tables (check/number/options
	// criterion) never hold stale rows for the previous kind.
	const criteriaToRecreate = plan.criterionKindChanges.map(
		(change) => change.criterionId,
	);

	if (criteriaToRecreate.length > 0) {
		await db
			.deleteFrom("criterion")
			.where("gridRowId", "=", gridRowId)
			.where("id", "in", criteriaToRecreate)
			.execute();
	}

	if (rubricsById.length > 0) {
		await db
			.insertInto("rubric")
			.values(rubricsById.map((rubric) => ({ ...rubric, gridRowId })))
			.onConflict((conflict) =>
				conflict
					.columns(["gridRowId", "id"])
					.doUpdateSet((expressionBuilder) => ({
						label: expressionBuilder.ref("excluded.label"),
						position: expressionBuilder.ref("excluded.position"),
					})),
			)
			.execute();
	}

	const existingRubrics =
		rubricIds.length === 0
			? []
			: await db
					.selectFrom("rubric")
					.select(["id", "rowId"])
					.where("gridRowId", "=", gridRowId)
					.where("id", "in", rubricIds)
					.execute();

	const rubricRowIdByBusinessId = new Map(
		existingRubrics.map((rubric) => [rubric.id, rubric.rowId]),
	);

	const criterionRows = criterionSources.map((criterion) => {
		const rubricRowId = rubricRowIdByBusinessId.get(criterion.rubricId);

		if (rubricRowId == null) {
			throw new Error(
				`Imported criterion '${criterion.id}' references unknown rubric '${criterion.rubricId}'.`,
			);
		}

		return {
			id: criterion.id,
			rubricId: rubricRowId,
			position: criterion.position,
			description: criterion.description,
			label: criterion.label,
			gridRowId,
			kind: criterion.kind,
		};
	});

	if (criterionRows.length > 0) {
		await db
			.insertInto("criterion")
			.values(criterionRows)
			.onConflict((conflict) =>
				conflict
					.columns(["gridRowId", "id"])
					.doUpdateSet((expressionBuilder) => ({
						rubricId: expressionBuilder.ref("excluded.rubricId"),
						position: expressionBuilder.ref("excluded.position"),
						description: expressionBuilder.ref("excluded.description"),
						label: expressionBuilder.ref("excluded.label"),
						kind: expressionBuilder.ref("excluded.kind"),
					})),
			)
			.execute();
	}

	// The generic coordinator resolves criterion row ids, groups by kind, and
	// dispatches to each kind's batched subtype adapter (ADR 0013). This vertical
	// keeps its own criterion base-row batch upsert above, plus its transaction
	// and cache ownership. `rubricRowId` is omitted: an import spans multiple
	// rubrics per call, and criterion ids are unique within a grid.
	await saveCriterionSubtypesInDb(db, {
		criteria: rubrics.flatMap((rubric) => rubric.criteria),
		gridRowId,
	});

	return { rubricCount: rubricIds.length, criterionCount: criterionIds.length };
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveRubrics(
	{ rubrics, gridId }: { rubrics: ImportedRubrics; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<{
	rubricCount: number;
	criterionCount: number;
	kindChangedCriterionCount: number;
}> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadRubricImportContextFromDb(tx, {
			rubrics,
			gridId,
		});
		const plan = prepareRubricImport({ rubrics, context });

		if (plan.blockingDiagnostics.length > 0) {
			throw rubricImportBlockedError(plan.blockingDiagnostics);
		}

		const writeResult = await saveRubricImportPlanInDb(tx, { plan, gridId });

		return {
			...writeResult,
			kindChangedCriterionCount: plan.criterionKindChanges.length,
		};
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from rubricsImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateRubricImport({ gridId });

	return result;
}
