import "server-only";
import { type Kysely, sql } from "kysely";
import type { CriterionKind } from "#criteria/types.ts";
import {
	invalidateQuestionDefinitionDelete,
	invalidateQuestionDefinitionSave,
	invalidateQuestionReorder,
} from "#db/cacheInvalidation.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { resolveProjectRowId } from "#questions/questions.ts";
import { findDuplicateGroups } from "#utils/utils.ts";
import { QuestionsValidationError } from "./errors.ts";
import type {
	CriterionDefinitionInput,
	QuestionDefinitionInput,
} from "./questionDefinitions.ts";

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

	throw new QuestionsValidationError({ fieldErrors: { criteria } });
}

// `db` may be the global client or a caller-supplied transaction, so callers can
// compose this inside their own transaction (e.g. a batch edit).
export async function saveQuestionDefinitionInDb(
	db: Kysely<DB>,
	{ input, projectId }: { input: QuestionDefinitionInput; projectId: string },
): Promise<{ id: string; originalId: string }> {
	const projectRowId = await resolveProjectRowId(db, projectId);

	const requestedId = input.id.trim();
	const originalId = input.originalId?.trim() || requestedId;

	if (requestedId.length === 0) {
		// Defensive: questionDefinitionSchema already requires a non-empty id, so
		// this should be unreachable through validated input. Typed as a domain
		// error so it stays a recognized, actionable message if it is ever hit.
		throw new QuestionsValidationError({
			fieldErrors: { questionId: "Question id is required." },
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

	const scopedExistingQuestion = await db
		.selectFrom("question")
		.select(["id", "position", "rowId"])
		.where("id", "=", originalId)
		.where("question.projectId", "=", projectRowId)
		.executeTakeFirst();

	const conflictingQuestion =
		originalId !== requestedId
			? await db
					.selectFrom("question")
					.select("id")
					.where("id", "=", requestedId)
					.where("question.projectId", "=", projectRowId)
					.executeTakeFirst()
			: null;

	if (conflictingQuestion != null) {
		throw new QuestionsValidationError({
			fieldErrors: {
				questionId: `Question id '${requestedId}' already exists.`,
			},
		});
	}

	if (scopedExistingQuestion == null) {
		const row = await db
			.selectFrom("question")
			.select(({ fn }) => [fn.max<number>("position").as("maxPosition")])
			.where("question.projectId", "=", projectRowId)
			.executeTakeFirst();
		const nextPosition = (row?.maxPosition ?? -1) + 1;

		await db
			.insertInto("question")
			.values({
				id: requestedId,
				label: normalizeOptionalText(input.label),
				position: nextPosition,
				projectId: projectRowId,
			})
			.execute();
	} else {
		await db
			.updateTable("question")
			.set({ id: requestedId, label: normalizeOptionalText(input.label) })
			.where("id", "=", originalId)
			.where("question.projectId", "=", projectRowId)
			.execute();
	}

	const persistedQuestion = await db
		.selectFrom("question")
		.select(["id", "rowId"])
		.where("id", "=", requestedId)
		.where("question.projectId", "=", projectRowId)
		.executeTakeFirstOrThrow();

	let existingCriteriaQuery = db
		.selectFrom("criterion")
		.select(["id", "kind", "rowId"])
		.where("questionId", "=", persistedQuestion.rowId);

	existingCriteriaQuery = existingCriteriaQuery.where(
		"criterion.projectId",
		"=",
		projectRowId,
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
			.where("criterion.projectId", "=", projectRowId)
			.execute();
	}

	for (const criterion of normalizedCriteria) {
		const existing = existingById.get(criterion.sourceId);

		if (existing == null) {
			await db
				.insertInto("criterion")
				.values({
					id: criterion.id,
					questionId: persistedQuestion.rowId,
					position: criterion.position,
					description: criterion.description,
					label: criterion.label,
					projectId: projectRowId,
					kind: criterion.kind,
				})
				.execute();
			continue;
		}

		const isTypeChanged = existing.kind !== criterion.kind;
		if (isTypeChanged) {
			await db
				.deleteFrom("criterion")
				.where("rowId", "=", existing.rowId)
				.where("criterion.projectId", "=", projectRowId)
				.execute();
			await db
				.insertInto("criterion")
				.values({
					id: criterion.id,
					questionId: persistedQuestion.rowId,
					position: criterion.position,
					description: criterion.description,
					label: criterion.label,
					projectId: projectRowId,
					kind: criterion.kind,
				})
				.execute();
			continue;
		}

		await db
			.updateTable("criterion")
			.set({
				id: criterion.id,
				questionId: persistedQuestion.rowId,
				position: criterion.position,
				description: criterion.description,
				label: criterion.label,
				projectId: projectRowId,
				kind: criterion.kind,
			})
			.where("rowId", "=", existing.rowId)
			.where("criterion.projectId", "=", projectRowId)
			.execute();
	}

	const criterionRows = await db
		.selectFrom("criterion")
		.select(["id", "rowId"])
		.where(
			"id",
			"in",
			input.criteria.map((criterion) => criterion.id),
		)
		.where("questionId", "=", persistedQuestion.rowId)
		.where("criterion.projectId", "=", projectRowId)
		.execute();

	const criterionRowIdById = new Map(
		criterionRows.map((criterion) => [criterion.id, criterion.rowId]),
	);

	const booleanRows = input.criteria.flatMap((criterion) =>
		criterion.kind === "check"
			? (() => {
					const criterionRowId = criterionRowIdById.get(criterion.id);
					if (criterionRowId == null) {
						throw new Error(
							`Criterion '${criterion.id}' could not be resolved.`,
						);
					}

					return [
						{
							criterionId: criterionRowId,
							marks: criterion.marks,
							falseMarks: criterion.falseMarks ?? 0,
						},
					];
				})()
			: [],
	);
	const numericalRows = input.criteria.flatMap((criterion) =>
		criterion.kind === "number"
			? (() => {
					const criterionRowId = criterionRowIdById.get(criterion.id);
					if (criterionRowId == null) {
						throw new Error(
							`Criterion '${criterion.id}' could not be resolved.`,
						);
					}

					return [
						{
							criterionId: criterionRowId,
							minScore: criterion.minScore,
							maxScore: criterion.maxScore,
							minMarks: criterion.minMarks,
							maxMarks: criterion.maxMarks,
							reversed: criterion.reversed,
						},
					];
				})()
			: [],
	);
	const ordinalSources = input.criteria.flatMap((criterion) =>
		criterion.kind === "options"
			? (() => {
					const criterionRowId = criterionRowIdById.get(criterion.id);
					if (criterionRowId == null) {
						throw new Error(
							`Criterion '${criterion.id}' could not be resolved.`,
						);
					}

					return [{ criterionId: criterionRowId, marks: criterion.marks }];
				})()
			: [],
	);

	if (booleanRows.length > 0) {
		await db
			.insertInto("checkCriterion")
			.values(booleanRows)
			.onConflict((conflict) =>
				conflict
					.column("criterionId")
					.doUpdateSet((eb) => ({
						marks: eb.ref("excluded.marks"),
						falseMarks: eb.ref("excluded.falseMarks"),
					})),
			)
			.execute();
	}

	if (numericalRows.length > 0) {
		await db
			.insertInto("numberCriterion")
			.values(numericalRows)
			.onConflict((conflict) =>
				conflict
					.column("criterionId")
					.doUpdateSet((eb) => ({
						minScore: eb.ref("excluded.minScore"),
						maxScore: eb.ref("excluded.maxScore"),
						minMarks: eb.ref("excluded.minMarks"),
						maxMarks: eb.ref("excluded.maxMarks"),
						reversed: eb.ref("excluded.reversed"),
					})),
			)
			.execute();
	}

	if (ordinalSources.length > 0) {
		await db
			.insertInto("optionsCriterion")
			.values(
				ordinalSources.map((source) => ({ criterionId: source.criterionId })),
			)
			.onConflict((conflict) => conflict.column("criterionId").doNothing())
			.execute();

		const optionsCriterions = await db
			.selectFrom("optionsCriterion")
			.select(["id", "criterionId"])
			.where(
				"criterionId",
				"in",
				ordinalSources.map((source) => source.criterionId),
			)
			.execute();

		const optionsCriterionIdByCriterionId = new Map(
			optionsCriterions.map((row) => [row.criterionId, row.id]),
		);
		const optionsCriterionIds = optionsCriterions.map((row) => row.id);

		const existingOrdinalValues =
			optionsCriterionIds.length === 0
				? []
				: await db
						.selectFrom("optionsCriterionMark")
						.select(["id", "optionsCriterionId", "label"])
						.where("optionsCriterionId", "in", optionsCriterionIds)
						.execute();

		const validKeys = new Set(
			ordinalSources.flatMap((source) => {
				const optionsCriterionId = optionsCriterionIdByCriterionId.get(
					source.criterionId,
				);
				if (optionsCriterionId == null) {
					return [];
				}

				return Object.keys(source.marks).map(
					(label) => `${optionsCriterionId}::${label}`,
				);
			}),
		);

		const staleIds = existingOrdinalValues
			.filter(
				(value) =>
					!validKeys.has(`${value.optionsCriterionId}::${value.label}`),
			)
			.map((value) => value.id);

		if (staleIds.length > 0) {
			await db
				.deleteFrom("optionsCriterionMark")
				.where("id", "in", staleIds)
				.execute();
		}

		const ordinalValueRows = ordinalSources.flatMap((source) => {
			const optionsCriterionId = optionsCriterionIdByCriterionId.get(
				source.criterionId,
			);
			if (optionsCriterionId == null) {
				return [];
			}

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
						.doUpdateSet((eb) => ({ marks: eb.ref("excluded.marks") })),
				)
				.execute();
		}
	}

	return { id: requestedId, originalId };
}

export async function saveQuestionDefinition(
	{ input, projectId }: { input: QuestionDefinitionInput; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ id: string }> {
	const { id, originalId } = await db
		.transaction()
		.execute((tx) => saveQuestionDefinitionInDb(tx, { input, projectId }));

	invalidateQuestionDefinitionSave({
		questionId: id,
		previousQuestionId: originalId,
	});

	return { id };
}

// `db` may be the global client or a caller-supplied transaction.
export async function deleteQuestionDefinitionInDb(
	db: Kysely<DB>,
	{ questionId, projectId }: { questionId: string; projectId: string },
): Promise<{ deleted: boolean }> {
	const result = await db
		.deleteFrom("question")
		.where("question.id", "=", questionId)
		.where(
			"question.projectId",
			"=",
			db
				.selectFrom("project")
				.select("rowId")
				.where("project.id", "=", projectId),
		)
		.executeTakeFirst();

	return { deleted: (result?.numDeletedRows ?? 0n) > 0n };
}

export async function deleteQuestionDefinition(
	{ questionId, projectId }: { questionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ deleted: boolean }> {
	const result = await deleteQuestionDefinitionInDb(db, {
		questionId,
		projectId,
	});

	invalidateQuestionDefinitionDelete({ questionId });

	return result;
}

// `db` may be the global client or a caller-supplied transaction.
export async function reorderQuestionsInDb(
	db: Kysely<DB>,
	{
		updates,
		projectId,
	}: { updates: Array<{ id: string; position: number }>; projectId: string },
): Promise<void> {
	if (updates.length === 0) return;

	const questionIds = updates.map((u) => u.id);
	const duplicateGroups = findDuplicateGroups(questionIds);
	if (duplicateGroups.length > 0) {
		throw new Error(
			`Each question can only be reordered once per request. Duplicated question ids: ${duplicateGroups
				.map((group) => group.key)
				.join(", ")}.`,
		);
	}

	const conditions = updates.map(
		({ id, position }) =>
			sql`when ${sql.ref("id")} = ${sql.lit(id)} then ${sql.lit(position)}`,
	);

	const updated = await db
		.updateTable("question")
		.set({ position: sql`case ${sql.join(conditions, sql` `)} end` })
		.where("question.id", "in", questionIds)
		.where(
			"question.projectId",
			"=",
			db
				.selectFrom("project")
				.select("rowId")
				.where("project.id", "=", projectId),
		)
		.returning("question.id")
		.execute();

	if (updated.length !== questionIds.length) {
		const foundIds = new Set(updated.map((row) => row.id));
		const missingIds = questionIds.filter((id) => !foundIds.has(id));
		throw new Error(
			`Some questions were not found in this project: ${missingIds.join(", ")}.`,
		);
	}
}

export async function reorderQuestions(
	{
		updates,
		projectId,
	}: { updates: Array<{ id: string; position: number }>; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<void> {
	await db
		.transaction()
		.execute((tx) => reorderQuestionsInDb(tx, { updates, projectId }));

	invalidateQuestionReorder();
}
