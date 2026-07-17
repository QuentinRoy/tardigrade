import "server-only";
import { type Kysely, sql, type Transaction } from "kysely";
import { saveCriterionSubtypesInDb } from "#criteria/criterionSubtypePersistence.ts";
import type {
	CriterionDefinitionInput,
	CriterionKind,
} from "#criteria/types.ts";
import {
	invalidateRubricDefinitionDelete,
	invalidateRubricDefinitionSave,
	invalidateRubricReorder,
} from "#db/cacheInvalidation.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { resolveGridRowId } from "#rubrics/rubrics.ts";
import { findDuplicateGroups } from "#utils/utils.ts";
import { RubricsValidationError } from "./errors.ts";
import type { RubricDefinitionInput } from "./rubricDefinitions.ts";

type NormalizedCriterionRow = {
	sourceId: string;
	id: string;
	position: number;
	description: string | null;
	label: string | null;
	kind: CriterionKind;
};

function normalizeOptionalText(value: string | undefined): string | null {
	const trimmed = value?.trim();
	if (trimmed == null || trimmed.length === 0) {
		return null;
	}
	return trimmed;
}

function toCriterionDefinitionRows(
	criteria: CriterionDefinitionInput[],
): NormalizedCriterionRow[] {
	return criteria.map((criterion, position) => ({
		sourceId: criterion.previousId?.trim() || criterion.id,
		id: criterion.id,
		position,
		description: normalizeOptionalText(criterion.description),
		label: normalizeOptionalText(criterion.label),
		kind: criterion.kind,
	}));
}

function assertUniqueIds(label: string, ids: string[]): void {
	const duplicateGroups = findDuplicateGroups(ids, (id) => {
		const key = id.trim();
		return key.length === 0 ? undefined : key;
	});

	if (duplicateGroups.length === 0) {
		return;
	}

	const criteria = Array.from<unknown, { id?: string }>(
		{ length: ids.length },
		() => ({}),
	);

	for (const { indexes } of duplicateGroups) {
		for (const index of indexes) {
			criteria[index] = { id: `${label} must be unique.` };
		}
	}

	throw new RubricsValidationError({ fieldErrors: { criteria } });
}

// `db` is a caller-supplied transaction, so callers can compose this inside
// their own transaction (e.g. a batch edit).
export async function saveRubricDefinitionInDb(
	db: Transaction<Database>,
	{ input, gridId }: { input: RubricDefinitionInput; gridId: string },
): Promise<{ id: string; originalId: string }> {
	const gridRowId = await resolveGridRowId(db, gridId);

	const requestedId = input.id.trim();
	const originalId = input.originalId?.trim() || requestedId;

	if (requestedId.length === 0) {
		// Defensive: rubricDefinitionSchema already requires a non-empty id, so
		// this should be unreachable through validated input. Typed as a domain
		// error so it stays a recognized, actionable message if it is ever hit.
		throw new RubricsValidationError({
			fieldErrors: { rubricId: "Rubric id is required." },
		});
	}

	assertUniqueIds(
		"Criterion ids",
		input.criteria.map((criterion) => criterion.id),
	);

	const normalizedCriteria = toCriterionDefinitionRows(input.criteria);
	assertUniqueIds(
		"Criterion source ids",
		normalizedCriteria.map((criterion) => criterion.sourceId),
	);

	const scopedExistingRubric = await db
		.selectFrom("rubric")
		.select(["id", "position", "rowId"])
		.where("id", "=", originalId)
		.where("rubric.gridRowId", "=", gridRowId)
		.executeTakeFirst();

	const conflictingRubric =
		originalId !== requestedId
			? await db
					.selectFrom("rubric")
					.select("id")
					.where("id", "=", requestedId)
					.where("rubric.gridRowId", "=", gridRowId)
					.executeTakeFirst()
			: null;

	if (conflictingRubric != null) {
		throw new RubricsValidationError({
			fieldErrors: { rubricId: `Rubric id '${requestedId}' already exists.` },
		});
	}

	if (scopedExistingRubric == null) {
		const row = await db
			.selectFrom("rubric")
			.select(({ fn }) => [fn.max<number>("position").as("maxPosition")])
			.where("rubric.gridRowId", "=", gridRowId)
			.executeTakeFirst();
		const nextPosition = (row?.maxPosition ?? -1) + 1;

		await db
			.insertInto("rubric")
			.values({
				id: requestedId,
				label: normalizeOptionalText(input.label),
				position: nextPosition,
				gridRowId: gridRowId,
			})
			.execute();
	} else {
		await db
			.updateTable("rubric")
			.set({ id: requestedId, label: normalizeOptionalText(input.label) })
			.where("id", "=", originalId)
			.where("rubric.gridRowId", "=", gridRowId)
			.execute();
	}

	const persistedRubric = await db
		.selectFrom("rubric")
		.select(["id", "rowId"])
		.where("id", "=", requestedId)
		.where("rubric.gridRowId", "=", gridRowId)
		.executeTakeFirstOrThrow();

	let existingCriteriaQuery = db
		.selectFrom("criterion")
		.select(["id", "kind", "rowId"])
		.where("rubricId", "=", persistedRubric.rowId);

	existingCriteriaQuery = existingCriteriaQuery.where(
		"criterion.gridRowId",
		"=",
		gridRowId,
	);

	const existingCriteria = await existingCriteriaQuery.execute();

	const existingById = new Map(existingCriteria.map((row) => [row.id, row]));
	const referencedSourceIds = new Set(
		normalizedCriteria.map((criterion) => criterion.sourceId),
	);

	const staleCriterionIds = existingCriteria
		.filter((criterion) => !referencedSourceIds.has(criterion.id))
		.map((criterion) => criterion.rowId);

	if (staleCriterionIds.length > 0) {
		await db
			.deleteFrom("criterion")
			.where("rowId", "in", staleCriterionIds)
			.where("criterion.gridRowId", "=", gridRowId)
			.execute();
	}

	for (const criterion of normalizedCriteria) {
		const existing = existingById.get(criterion.sourceId);

		if (existing == null) {
			await db
				.insertInto("criterion")
				.values({
					id: criterion.id,
					rubricId: persistedRubric.rowId,
					position: criterion.position,
					description: criterion.description,
					label: criterion.label,
					gridRowId: gridRowId,
					kind: criterion.kind,
				})
				.execute();
			continue;
		}

		const isKindChanged = existing.kind !== criterion.kind;
		if (isKindChanged) {
			await db
				.deleteFrom("criterion")
				.where("rowId", "=", existing.rowId)
				.where("criterion.gridRowId", "=", gridRowId)
				.execute();
			await db
				.insertInto("criterion")
				.values({
					id: criterion.id,
					rubricId: persistedRubric.rowId,
					position: criterion.position,
					description: criterion.description,
					label: criterion.label,
					gridRowId: gridRowId,
					kind: criterion.kind,
				})
				.execute();
			continue;
		}

		await db
			.updateTable("criterion")
			.set({
				id: criterion.id,
				rubricId: persistedRubric.rowId,
				position: criterion.position,
				description: criterion.description,
				label: criterion.label,
				gridRowId: gridRowId,
				kind: criterion.kind,
			})
			.where("rowId", "=", existing.rowId)
			.where("criterion.gridRowId", "=", gridRowId)
			.execute();
	}

	// The generic coordinator resolves criterion row ids, groups by kind, and
	// dispatches to each kind's batched subtype adapter (ADR 0013). This vertical
	// keeps its own criterion base-row rename-by-`previousId` loop above and its
	// transaction/cache ownership.
	await saveCriterionSubtypesInDb(db, {
		criteria: input.criteria,
		gridRowId,
		rubricRowId: persistedRubric.rowId,
	});

	return { id: requestedId, originalId };
}

export async function saveRubricDefinition(
	{ input, gridId }: { input: RubricDefinitionInput; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<{ id: string }> {
	const { id, originalId } = await db
		.transaction()
		.execute((tx) => saveRubricDefinitionInDb(tx, { input, gridId }));

	invalidateRubricDefinitionSave({
		gridId,
		rubricId: id,
		previousRubricId: originalId,
	});

	return { id };
}

// `db` is a caller-supplied transaction; this write primitive cannot run on
// the global client.
export async function deleteRubricDefinitionInDb(
	db: Transaction<Database>,
	{ rubricId, gridId }: { rubricId: string; gridId: string },
): Promise<{ deleted: boolean }> {
	const result = await db
		.deleteFrom("rubric")
		.where("rubric.id", "=", rubricId)
		.where(
			"rubric.gridRowId",
			"=",
			db.selectFrom("grid").select("rowId").where("grid.id", "=", gridId),
		)
		.executeTakeFirst();

	return { deleted: (result?.numDeletedRows ?? 0n) > 0n };
}

export async function deleteRubricDefinition(
	{ rubricId, gridId }: { rubricId: string; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<{ deleted: boolean }> {
	const result = await db
		.transaction()
		.execute((tx) => deleteRubricDefinitionInDb(tx, { rubricId, gridId }));

	invalidateRubricDefinitionDelete({ gridId, rubricId });

	return result;
}

// `db` is a caller-supplied transaction; this write primitive cannot run on
// the global client.
export async function reorderRubricsInDb(
	db: Transaction<Database>,
	{
		updates,
		gridId,
	}: { updates: Array<{ id: string; position: number }>; gridId: string },
): Promise<void> {
	if (updates.length === 0) return;

	const rubricIds = updates.map((u) => u.id);
	const duplicateGroups = findDuplicateGroups(rubricIds);
	if (duplicateGroups.length > 0) {
		throw new Error(
			`Each rubric can only be reordered once per request. Duplicated rubric ids: ${duplicateGroups
				.map((group) => group.key)
				.join(", ")}.`,
		);
	}

	const conditions = updates.map(
		({ id, position }) =>
			sql`when ${sql.ref("id")} = ${sql.lit(id)} then ${sql.lit(position)}`,
	);

	const updated = await db
		.updateTable("rubric")
		.set({ position: sql`case ${sql.join(conditions, sql` `)} end` })
		.where("rubric.id", "in", rubricIds)
		.where(
			"rubric.gridRowId",
			"=",
			db.selectFrom("grid").select("rowId").where("grid.id", "=", gridId),
		)
		.returning("rubric.id")
		.execute();

	if (updated.length !== rubricIds.length) {
		const foundIds = new Set(updated.map((row) => row.id));
		const missingIds = rubricIds.filter((id) => !foundIds.has(id));
		throw new Error(
			`Some rubrics were not found in this grid: ${missingIds.join(", ")}.`,
		);
	}
}

export async function reorderRubrics(
	{
		updates,
		gridId,
	}: { updates: Array<{ id: string; position: number }>; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<void> {
	await db
		.transaction()
		.execute((tx) => reorderRubricsInDb(tx, { updates, gridId }));

	invalidateRubricReorder({ gridId });
}
