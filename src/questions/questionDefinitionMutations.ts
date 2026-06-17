import "server-only";
import { type Kysely, sql } from "kysely";
import {
	invalidateQuestionDefinitionDelete,
	invalidateQuestionDefinitionSave,
	invalidateQuestionReorder,
} from "#db/cacheInvalidation.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { QuestionsValidationError } from "#questions/errors.ts";
import type { RubricType } from "#rubrics/types.ts";
import { findDuplicateGroups } from "#utils/utils.ts";
import type {
	QuestionDefinitionInput,
	RubricDefinitionInput,
} from "./questionDefinitions.ts";
import { resolveProjectRowId } from "./questions.ts";

type NormalizedRubricRow = {
	sourceId: string;
	id: string;
	position: number;
	description: string | null;
	label: string | null;
	type: RubricType;
};

function normalizeOptionalText(value: string | undefined): string | null {
	const trimmed = value?.trim();
	if (trimmed == null || trimmed.length === 0) {
		return null;
	}
	return trimmed;
}

function toRubricDefinitionRows(
	rubrics: RubricDefinitionInput[],
): NormalizedRubricRow[] {
	return rubrics.map((rubric, position) => ({
		sourceId: rubric.previousId?.trim() || rubric.id,
		id: rubric.id,
		position,
		description: normalizeOptionalText(rubric.description),
		label: normalizeOptionalText(rubric.label),
		type: rubric.type,
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

	const rubrics = Array.from(
		{ length: ids.length },
		() => ({}) as { id?: string },
	);

	for (const { indexes } of duplicateGroups) {
		for (const index of indexes) {
			rubrics[index] = { id: `${label} must be unique.` };
		}
	}

	throw new QuestionsValidationError({ fieldErrors: { rubrics } });
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
		throw new Error("Question id is required.");
	}

	assertUniqueIds(
		"Rubric ids",
		input.rubrics.map((rubric) => rubric.id),
	);

	const normalizedRubrics = toRubricDefinitionRows(input.rubrics);
	assertUniqueIds(
		"Rubric source ids",
		normalizedRubrics.map((rubric) => rubric.sourceId),
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

	let existingRubricsQuery = db
		.selectFrom("rubric")
		.select(["id", "type", "rowId"])
		.where("questionId", "=", persistedQuestion.rowId);

	existingRubricsQuery = existingRubricsQuery.where(
		"rubric.projectId",
		"=",
		projectRowId,
	);

	const existingRubrics = await existingRubricsQuery.execute();

	const existingById = new Map(existingRubrics.map((row) => [row.id, row]));
	const referencedSourceIds = new Set(
		normalizedRubrics.map((rubric) => rubric.sourceId),
	);

	const staleRubricIds = existingRubrics
		.filter((rubric) => !referencedSourceIds.has(rubric.id))
		.map((rubric) => rubric.rowId);

	if (staleRubricIds.length > 0) {
		await db
			.deleteFrom("rubric")
			.where("rowId", "in", staleRubricIds)
			.where("rubric.projectId", "=", projectRowId)
			.execute();
	}

	for (const rubric of normalizedRubrics) {
		const existing = existingById.get(rubric.sourceId);

		if (existing == null) {
			await db
				.insertInto("rubric")
				.values({
					id: rubric.id,
					questionId: persistedQuestion.rowId,
					position: rubric.position,
					description: rubric.description,
					label: rubric.label,
					projectId: projectRowId,
					type: rubric.type,
				})
				.execute();
			continue;
		}

		const isTypeChanged = existing.type !== rubric.type;
		if (isTypeChanged) {
			await db
				.deleteFrom("rubric")
				.where("rowId", "=", existing.rowId)
				.where("rubric.projectId", "=", projectRowId)
				.execute();
			await db
				.insertInto("rubric")
				.values({
					id: rubric.id,
					questionId: persistedQuestion.rowId,
					position: rubric.position,
					description: rubric.description,
					label: rubric.label,
					projectId: projectRowId,
					type: rubric.type,
				})
				.execute();
			continue;
		}

		await db
			.updateTable("rubric")
			.set({
				id: rubric.id,
				questionId: persistedQuestion.rowId,
				position: rubric.position,
				description: rubric.description,
				label: rubric.label,
				projectId: projectRowId,
				type: rubric.type,
			})
			.where("rowId", "=", existing.rowId)
			.where("rubric.projectId", "=", projectRowId)
			.execute();
	}

	const rubricRows = await db
		.selectFrom("rubric")
		.select(["id", "rowId"])
		.where(
			"id",
			"in",
			input.rubrics.map((rubric) => rubric.id),
		)
		.where("questionId", "=", persistedQuestion.rowId)
		.where("rubric.projectId", "=", projectRowId)
		.execute();

	const rubricRowIdById = new Map(
		rubricRows.map((rubric) => [rubric.id, rubric.rowId]),
	);

	const booleanRows = input.rubrics.flatMap((rubric) =>
		rubric.type === "boolean"
			? (() => {
					const rubricRowId = rubricRowIdById.get(rubric.id);
					if (rubricRowId == null) {
						throw new Error(`Rubric '${rubric.id}' could not be resolved.`);
					}

					return [
						{
							rubricId: rubricRowId,
							marks: rubric.marks,
							falseMarks: rubric.falseMarks ?? 0,
						},
					];
				})()
			: [],
	);
	const numericalRows = input.rubrics.flatMap((rubric) =>
		rubric.type === "numerical"
			? (() => {
					const rubricRowId = rubricRowIdById.get(rubric.id);
					if (rubricRowId == null) {
						throw new Error(`Rubric '${rubric.id}' could not be resolved.`);
					}

					return [
						{
							rubricId: rubricRowId,
							minScore: rubric.minScore,
							maxScore: rubric.maxScore,
							minMarks: rubric.minMarks,
							maxMarks: rubric.maxMarks,
							reversed: rubric.reversed,
						},
					];
				})()
			: [],
	);
	const ordinalSources = input.rubrics.flatMap((rubric) =>
		rubric.type === "ordinal"
			? (() => {
					const rubricRowId = rubricRowIdById.get(rubric.id);
					if (rubricRowId == null) {
						throw new Error(`Rubric '${rubric.id}' could not be resolved.`);
					}

					return [{ rubricId: rubricRowId, marks: rubric.marks }];
				})()
			: [],
	);

	if (booleanRows.length > 0) {
		await db
			.insertInto("booleanRubric")
			.values(booleanRows)
			.onConflict((conflict) =>
				conflict
					.column("rubricId")
					.doUpdateSet((eb) => ({
						marks: eb.ref("excluded.marks"),
						falseMarks: eb.ref("excluded.falseMarks"),
					})),
			)
			.execute();
	}

	if (numericalRows.length > 0) {
		await db
			.insertInto("numericalRubric")
			.values(numericalRows)
			.onConflict((conflict) =>
				conflict
					.column("rubricId")
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
			.insertInto("ordinalRubric")
			.values(ordinalSources.map((source) => ({ rubricId: source.rubricId })))
			.onConflict((conflict) => conflict.column("rubricId").doNothing())
			.execute();

		const ordinalRubrics = await db
			.selectFrom("ordinalRubric")
			.select(["id", "rubricId"])
			.where(
				"rubricId",
				"in",
				ordinalSources.map((source) => source.rubricId),
			)
			.execute();

		const ordinalRubricIdByRubricId = new Map(
			ordinalRubrics.map((row) => [row.rubricId, row.id]),
		);
		const ordinalRubricIds = ordinalRubrics.map((row) => row.id);

		const existingOrdinalValues =
			ordinalRubricIds.length === 0
				? []
				: await db
						.selectFrom("ordinalRubricValue")
						.select(["id", "ordinalRubricId", "label"])
						.where("ordinalRubricId", "in", ordinalRubricIds)
						.execute();

		const validKeys = new Set(
			ordinalSources.flatMap((source) => {
				const ordinalRubricId = ordinalRubricIdByRubricId.get(source.rubricId);
				if (ordinalRubricId == null) {
					return [];
				}

				return Object.keys(source.marks).map(
					(label) => `${ordinalRubricId}::${label}`,
				);
			}),
		);

		const staleIds = existingOrdinalValues
			.filter(
				(value) => !validKeys.has(`${value.ordinalRubricId}::${value.label}`),
			)
			.map((value) => value.id);

		if (staleIds.length > 0) {
			await db
				.deleteFrom("ordinalRubricValue")
				.where("id", "in", staleIds)
				.execute();
		}

		const ordinalValueRows = ordinalSources.flatMap((source) => {
			const ordinalRubricId = ordinalRubricIdByRubricId.get(source.rubricId);
			if (ordinalRubricId == null) {
				return [];
			}

			return Object.entries(source.marks).map(([label, marks]) => ({
				ordinalRubricId,
				label,
				marks,
			}));
		});

		if (ordinalValueRows.length > 0) {
			await db
				.insertInto("ordinalRubricValue")
				.values(ordinalValueRows)
				.onConflict((conflict) =>
					conflict
						.columns(["ordinalRubricId", "label"])
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
