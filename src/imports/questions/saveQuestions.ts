import "server-only";
import type { Kysely } from "kysely";
import { invalidateQuestionImport } from "#db/cacheInvalidation.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { ImportBlockedError } from "#imports/importErrors.ts";
import type { ImportedQuestions } from "#imports/types.ts";
import {
	prepareQuestionImport,
	type QuestionImportBlockingDiagnostic,
	type QuestionImportPlan,
} from "./prepareQuestionImport.ts";
import { loadQuestionImportContextFromDb } from "./questionImportContext.ts";

function formatBlockingDiagnostic(
	diagnostic: QuestionImportBlockingDiagnostic,
): string {
	switch (diagnostic.kind) {
		case "criterion-type-change-blocked": {
			return `Criterion "${diagnostic.criterionId}" of question "${diagnostic.questionId}" has ${diagnostic.assessmentCount} linked assessments and cannot change type on import. Edit it in question management instead.`;
		}
		case "criterion-question-mismatch": {
			return `Criterion "${diagnostic.criterionId}" already belongs to question "${diagnostic.existingQuestionId}" and cannot be moved to question "${diagnostic.importQuestionId}" on import.`;
		}
	}
}

function questionImportBlockedError(
	blockingDiagnostics: QuestionImportBlockingDiagnostic[],
): ImportBlockedError {
	const lines = blockingDiagnostics.map(formatBlockingDiagnostic);

	return new ImportBlockedError(
		`Question import errors:\n${lines.join("\n")}\nNothing was imported. Fix the listed issues and retry.`,
	);
}

// `db` may be the global client or a caller-supplied transaction. Executes a
// plan's writes; never opens a transaction and never invalidates cache.
export async function saveQuestionImportPlanInDb(
	db: Kysely<DB>,
	{ plan, projectId }: { plan: QuestionImportPlan; projectId: string },
): Promise<{ questionCount: number; criterionCount: number }> {
	const questions: ImportedQuestions = plan.writes;

	const questionsById = questions.map((question, position) => ({
		id: question.id,
		label: question.label ?? null,
		position,
	}));

	const criterionSources = questions.flatMap((question) =>
		question.criteria.map((criterion, position) => ({
			id: criterion.id,
			questionId: question.id,
			position,
			description: criterion.description ?? null,
			label: criterion.label ?? null,
			kind: criterion.kind,
		})),
	);

	const checkCriterionSources = questions.flatMap((question) =>
		question.criteria.flatMap((criterion) =>
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

	const numberCriterionSources = questions.flatMap((question) =>
		question.criteria.flatMap((criterion) =>
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

	const optionsCriterionSources = questions.flatMap((question) =>
		question.criteria.flatMap((criterion) =>
			criterion.kind === "options"
				? [{ criterionId: criterion.id, marks: criterion.marks }]
				: [],
		),
	);

	const questionIds = questionsById.map((question) => question.id);
	const criterionIds = criterionSources.map((criterion) => criterion.id);

	const projectRow = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = projectRow.rowId;

	// Criteria whose type changed (no linked assessments, per the prepared plan)
	// are deleted and recreated so subtype tables (boolean/numerical/ordinal
	// criterion) never hold stale rows for the previous type.
	const criteriaToRecreate = plan.criterionTypeChanges.map(
		(change) => change.criterionId,
	);

	if (criteriaToRecreate.length > 0) {
		await db
			.deleteFrom("criterion")
			.where("projectId", "=", projectRowId)
			.where("id", "in", criteriaToRecreate)
			.execute();
	}

	if (questionsById.length > 0) {
		await db
			.insertInto("question")
			.values(
				questionsById.map((question) => ({
					...question,
					projectId: projectRowId,
				})),
			)
			.onConflict((conflict) =>
				conflict
					.columns(["projectId", "id"])
					.doUpdateSet((expressionBuilder) => ({
						label: expressionBuilder.ref("excluded.label"),
						position: expressionBuilder.ref("excluded.position"),
					})),
			)
			.execute();
	}

	const existingQuestions =
		questionIds.length === 0
			? []
			: await db
					.selectFrom("question")
					.select(["id", "rowId"])
					.where("projectId", "=", projectRowId)
					.where("id", "in", questionIds)
					.execute();

	const questionRowIdByBusinessId = new Map(
		existingQuestions.map((question) => [question.id, question.rowId]),
	);

	const criterionRows = criterionSources.map((criterion) => {
		const questionRowId = questionRowIdByBusinessId.get(criterion.questionId);

		if (questionRowId == null) {
			throw new Error(
				`Imported criterion '${criterion.id}' references unknown question '${criterion.questionId}'.`,
			);
		}

		return {
			id: criterion.id,
			questionId: questionRowId,
			position: criterion.position,
			description: criterion.description,
			label: criterion.label,
			projectId: projectRowId,
			kind: criterion.kind,
		};
	});

	if (criterionRows.length > 0) {
		await db
			.insertInto("criterion")
			.values(criterionRows)
			.onConflict((conflict) =>
				conflict
					.columns(["projectId", "id"])
					.doUpdateSet((expressionBuilder) => ({
						questionId: expressionBuilder.ref("excluded.questionId"),
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
					.where("projectId", "=", projectRowId)
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

	return {
		questionCount: questionIds.length,
		criterionCount: criterionIds.length,
	};
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveQuestions(
	{ questions, projectId }: { questions: ImportedQuestions; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{
	questionCount: number;
	criterionCount: number;
	typeChangedCriterionCount: number;
}> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadQuestionImportContextFromDb(tx, {
			questions,
			projectId,
		});
		const plan = prepareQuestionImport({ questions, context });

		if (plan.blockingDiagnostics.length > 0) {
			throw questionImportBlockedError(plan.blockingDiagnostics);
		}

		const writeResult = await saveQuestionImportPlanInDb(tx, {
			plan,
			projectId,
		});

		return {
			...writeResult,
			typeChangedCriterionCount: plan.criterionTypeChanges.length,
		};
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from questionsImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateQuestionImport();

	return result;
}
