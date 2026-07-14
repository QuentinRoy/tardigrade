import "server-only";
import type { Kysely } from "kysely";
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
			return `Criterion "${diagnostic.criterionId}" of rubric "${diagnostic.rubricId}" has ${diagnostic.gradedTargetCount} linked grades and cannot change type on import. Edit it in rubric management instead.`;
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

	const checkCriterionSources = rubrics.flatMap((rubric) =>
		rubric.criteria.flatMap((criterion) =>
			criterion.kind === "check"
				? [
						{
							criterionId: criterion.id,
							marks: criterion.marks,
							falseMarks: criterion.falseMarks ?? 0,
						},
					]
				: [],
		),
	);

	const numberCriterionSources = rubrics.flatMap((rubric) =>
		rubric.criteria.flatMap((criterion) =>
			criterion.kind === "number"
				? [
						{
							criterionId: criterion.id,
							minScore: criterion.minScore,
							maxScore: criterion.maxScore,
							minMarks: criterion.minMarks,
							maxMarks: criterion.maxMarks,
							reversed: criterion.reversed,
						},
					]
				: [],
		),
	);

	const optionsCriterionSources = rubrics.flatMap((rubric) =>
		rubric.criteria.flatMap((criterion) =>
			criterion.kind === "options"
				? [{ criterionId: criterion.id, marks: criterion.marks }]
				: [],
		),
	);

	const rubricIds = rubricsById.map((rubric) => rubric.id);
	const criterionIds = criterionSources.map((criterion) => criterion.id);

	const gridRow = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = gridRow.rowId;

	// Criteria whose type changed (no linked grades, per the prepared plan)
	// are deleted and recreated so subtype tables (boolean/numerical/ordinal
	// criterion) never hold stale rows for the previous type.
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

	const existingPersistedCriteria =
		criterionIds.length === 0
			? []
			: await db
					.selectFrom("criterion")
					.select(["id", "rowId"])
					.where("gridRowId", "=", gridRowId)
					.where("id", "in", criterionIds)
					.execute();

	const criterionRowIdByBusinessId = new Map(
		existingPersistedCriteria.map((criterion) => [
			criterion.id,
			criterion.rowId,
		]),
	);

	const checkCriterionRows = checkCriterionSources.map((criterion) => {
		const criterionRowId = criterionRowIdByBusinessId.get(
			criterion.criterionId,
		);

		if (criterionRowId == null) {
			throw new Error(
				`Imported boolean criterion '${criterion.criterionId}' could not be resolved.`,
			);
		}

		return {
			criterionId: criterionRowId,
			marks: criterion.marks,
			falseMarks: criterion.falseMarks,
		};
	});

	if (checkCriterionRows.length > 0) {
		await db
			.insertInto("checkCriterion")
			.values(checkCriterionRows)
			.onConflict((conflict) =>
				conflict
					.column("criterionId")
					.doUpdateSet((expressionBuilder) => ({
						marks: expressionBuilder.ref("excluded.marks"),
						falseMarks: expressionBuilder.ref("excluded.falseMarks"),
					})),
			)
			.execute();
	}

	const numberCriterionRows = numberCriterionSources.map((criterion) => {
		const criterionRowId = criterionRowIdByBusinessId.get(
			criterion.criterionId,
		);

		if (criterionRowId == null) {
			throw new Error(
				`Imported numerical criterion '${criterion.criterionId}' could not be resolved.`,
			);
		}

		return {
			criterionId: criterionRowId,
			minScore: criterion.minScore,
			maxScore: criterion.maxScore,
			minMarks: criterion.minMarks,
			maxMarks: criterion.maxMarks,
			reversed: criterion.reversed,
		};
	});

	if (numberCriterionRows.length > 0) {
		await db
			.insertInto("numberCriterion")
			.values(numberCriterionRows)
			.onConflict((conflict) =>
				conflict
					.column("criterionId")
					.doUpdateSet((expressionBuilder) => ({
						minScore: expressionBuilder.ref("excluded.minScore"),
						maxScore: expressionBuilder.ref("excluded.maxScore"),
						minMarks: expressionBuilder.ref("excluded.minMarks"),
						maxMarks: expressionBuilder.ref("excluded.maxMarks"),
						reversed: expressionBuilder.ref("excluded.reversed"),
					})),
			)
			.execute();
	}

	if (optionsCriterionSources.length > 0) {
		const optionsCriterionRows = optionsCriterionSources.map((source) => {
			const criterionRowId = criterionRowIdByBusinessId.get(source.criterionId);

			if (criterionRowId == null) {
				throw new Error(
					`Imported ordinal criterion '${source.criterionId}' could not be resolved.`,
				);
			}

			return { criterionId: criterionRowId };
		});

		await db
			.insertInto("optionsCriterion")
			.values(optionsCriterionRows)
			.onConflict((conflict) => conflict.column("criterionId").doNothing())
			.execute();

		const optionsCriterionIdsToFetch = optionsCriterionRows.map(
			(source) => source.criterionId,
		);

		const upsertedOptionsCriterions = await db
			.selectFrom("optionsCriterion")
			.select(["id", "criterionId"])
			.where("criterionId", "in", optionsCriterionIdsToFetch)
			.execute();

		const optionsCriterionIdByCriterionId = new Map(
			upsertedOptionsCriterions.map((row) => [row.criterionId, row.id]),
		);

		const optionsCriterionIds = upsertedOptionsCriterions.map((row) => row.id);

		const validPairKeys = new Set(
			optionsCriterionSources.flatMap((source) => {
				const criterionRowId = criterionRowIdByBusinessId.get(
					source.criterionId,
				);
				if (criterionRowId == null) return [];

				const optionsCriterionId =
					optionsCriterionIdByCriterionId.get(criterionRowId);
				if (optionsCriterionId == null) return [];

				return Object.keys(source.marks).map(
					(label) => `${optionsCriterionId}::${label}`,
				);
			}),
		);

		const existingOrdinalValues =
			optionsCriterionIds.length === 0
				? []
				: await db
						.selectFrom("optionsCriterionMark")
						.select(["id", "optionsCriterionId", "label"])
						.where("optionsCriterionId", "in", optionsCriterionIds)
						.execute();

		const staleOrdinalValueIds = existingOrdinalValues
			.filter(
				(value) =>
					!validPairKeys.has(`${value.optionsCriterionId}::${value.label}`),
			)
			.map((value) => value.id);

		if (staleOrdinalValueIds.length > 0) {
			await db
				.deleteFrom("optionsCriterionMark")
				.where("id", "in", staleOrdinalValueIds)
				.execute();
		}

		const ordinalValueRows = optionsCriterionSources.flatMap((source) => {
			const criterionRowId = criterionRowIdByBusinessId.get(source.criterionId);
			if (criterionRowId == null) return [];

			const optionsCriterionId =
				optionsCriterionIdByCriterionId.get(criterionRowId);
			if (optionsCriterionId == null) return [];

			return Object.entries(source.marks).map(([label, marks]) => ({
				optionsCriterionId,
				label,
				marks,
			}));
		});

		if (ordinalValueRows.length > 0) {
			await db
				.insertInto("optionsCriterionMark")
				.values(ordinalValueRows)
				.onConflict((conflict) =>
					conflict
						.columns(["optionsCriterionId", "label"])
						.doUpdateSet((expressionBuilder) => ({
							marks: expressionBuilder.ref("excluded.marks"),
						})),
				)
				.execute();
		}
	}

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
	invalidateRubricImport();

	return result;
}
