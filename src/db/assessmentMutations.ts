import "server-only";
import type { Kysely, Transaction } from "kysely";
import { assertNever } from "#utils/utils.ts";
import {
	assessmentCacheTag,
	assessmentQuestionCacheTag,
	CACHE_TAGS,
	updateTags,
} from "./cacheTags.ts";
import type { DB } from "./generated/db.ts";
import { db } from "./kysely.ts";
import type { AssessmentRubricValue } from "./types.ts";

export type SaveAssessmentResult =
	| { success: true }
	| { success: false; error: string };

export type SaveAssessmentParams = {
	submissionId: string;
	questionId: string;
	rubric: AssessmentRubricValue;
};

export type AssessmentWriteDb = Kysely<DB> | Transaction<DB>;

const assessmentErrors = {
	contextMissing:
		"We couldn't match this grade to the selected student work. Reload and try again. If this keeps happening, report this issue.",
	criterionMissing:
		"We couldn't find this grading criterion. Reload and try again. If this keeps happening, report this issue.",
	criterionChanged:
		"This grading criterion changed while you were grading. Reload and try again.",
	invalidOption:
		"That option is no longer available. Reload and choose another option.",
	invalidScore: "Enter a valid score and try again.",
	invalidScoreRange:
		"This score range is currently unavailable. Reload and try again. If it still fails, report this issue.",
};

// Performs all validation + persistence against the given queryDb. No cache work.
// The queryDb is either the standalone connection or a caller-supplied transaction.
async function applySaveAssessment(
	queryDb: AssessmentWriteDb,
	{ submissionId, questionId, rubric: rubricValue }: SaveAssessmentParams,
): Promise<SaveAssessmentResult> {
	const rubricId = rubricValue.rubricId;

	const submission = await queryDb
		.selectFrom("submission")
		.where("id", "=", Number(submissionId))
		.select(["id", "projectId"])
		.executeTakeFirst();

	if (submission == null) {
		return { success: false, error: assessmentErrors.contextMissing };
	}

	const question = await queryDb
		.selectFrom("question")
		.where("id", "=", questionId)
		.where("projectId", "=", submission.projectId)
		.select(["id", "rowId", "projectId"])
		.executeTakeFirst();

	if (question == null) {
		return { success: false, error: assessmentErrors.contextMissing };
	}

	const rubric = await queryDb
		.selectFrom("rubric")
		.leftJoin("ordinalRubric", "ordinalRubric.rubricId", "rubric.rowId")
		.leftJoin(
			"ordinalRubricValue",
			"ordinalRubricValue.ordinalRubricId",
			"ordinalRubric.id",
		)
		.leftJoin("numericalRubric", "numericalRubric.rubricId", "rubric.rowId")
		.where("rubric.id", "=", rubricId)
		.where("rubric.projectId", "=", question.projectId)
		.select([
			"rubric.id",
			"rubric.rowId",
			"rubric.type",
			"rubric.questionId",
			"ordinalRubricValue.label",
			"numericalRubric.minScore",
			"numericalRubric.maxScore",
		])
		.executeTakeFirst();

	if (rubric == null || rubric.questionId !== question.rowId) {
		return { success: false, error: assessmentErrors.criterionMissing };
	}

	const rubricRowId = rubric.rowId;

	if (rubric.type !== rubricValue.type) {
		return { success: false, error: assessmentErrors.criterionChanged };
	}

	await queryDb
		.insertInto("assessment")
		.values({
			projectId: question.projectId,
			submissionId: submission.id,
			questionId: question.rowId,
		})
		.onConflict((conflict) =>
			conflict.columns(["submissionId", "questionId"]).doNothing(),
		)
		.execute();

	const existingAssessment = await queryDb
		.selectFrom("assessment")
		.where("submissionId", "=", submission.id)
		.where("questionId", "=", question.rowId)
		.select("id")
		.executeTakeFirstOrThrow();

	const assessmentId = existingAssessment.id;

	await queryDb
		.insertInto("rubricAssessment")
		.values({ assessmentId, rubricId: rubricRowId, type: rubricValue.type })
		.onConflict((conflict) =>
			conflict
				.columns(["assessmentId", "rubricId"])
				.doUpdateSet({ type: rubricValue.type }),
		)
		.execute();

	const existingRubricAssessment = await queryDb
		.selectFrom("rubricAssessment")
		.where("assessmentId", "=", assessmentId)
		.where("rubricId", "=", rubricRowId)
		.select("id")
		.executeTakeFirstOrThrow();

	const rubricAssessmentId = existingRubricAssessment.id;

	async function saveBooleanAssessment(
		value: Extract<AssessmentRubricValue, { type: "boolean" }>,
	): Promise<SaveAssessmentResult | void> {
		await Promise.all([
			queryDb
				.insertInto("booleanRubricAssessment")
				.values({ rubricAssessmentId, passed: value.passed })
				.onConflict((conflict) =>
					conflict
						.column("rubricAssessmentId")
						.doUpdateSet({ passed: value.passed }),
				)
				.execute(),
			queryDb
				.deleteFrom("ordinalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
			queryDb
				.deleteFrom("numericalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
		]);
	}

	async function saveOrdinalAssessment(
		value: Extract<AssessmentRubricValue, { type: "ordinal" }>,
	): Promise<SaveAssessmentResult | void> {
		const ordinalLabels = await queryDb
			.selectFrom("ordinalRubricValue")
			.innerJoin(
				"ordinalRubric",
				"ordinalRubric.id",
				"ordinalRubricValue.ordinalRubricId",
			)
			.where("ordinalRubric.rubricId", "=", rubricRowId)
			.select("ordinalRubricValue.label")
			.execute();

		const allowedValues = ordinalLabels.map((item) => item.label);
		if (!allowedValues.includes(value.selectedLabel)) {
			return { success: false, error: assessmentErrors.invalidOption };
		}

		await Promise.all([
			queryDb
				.insertInto("ordinalRubricAssessment")
				.values({ rubricAssessmentId, selectedLabel: value.selectedLabel })
				.onConflict((conflict) =>
					conflict
						.column("rubricAssessmentId")
						.doUpdateSet({ selectedLabel: value.selectedLabel }),
				)
				.execute(),
			queryDb
				.deleteFrom("booleanRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
			queryDb
				.deleteFrom("numericalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
		]);
	}

	async function saveNumericalAssessment(
		value: Extract<AssessmentRubricValue, { type: "numerical" }>,
	): Promise<SaveAssessmentResult | void> {
		const parsed = value.score;
		if (!Number.isFinite(parsed)) {
			return { success: false, error: assessmentErrors.invalidScore };
		}

		const numericalRubricData = await queryDb
			.selectFrom("numericalRubric")
			.where("rubricId", "=", rubricRowId)
			.select(["minScore", "maxScore"])
			.executeTakeFirst();

		const minScore =
			numericalRubricData?.minScore != null
				? Number(numericalRubricData.minScore)
				: null;
		const maxScore =
			numericalRubricData?.maxScore != null
				? Number(numericalRubricData.maxScore)
				: null;

		if (minScore == null || maxScore == null || maxScore <= minScore) {
			return { success: false, error: assessmentErrors.invalidScoreRange };
		}

		if (parsed < minScore) {
			return {
				success: false,
				error: `Enter a score of at least ${minScore}.`,
			};
		}
		if (parsed > maxScore) {
			return { success: false, error: `Enter a score of at most ${maxScore}.` };
		}

		await Promise.all([
			queryDb
				.insertInto("numericalRubricAssessment")
				.values({ rubricAssessmentId, score: parsed })
				.onConflict((conflict) =>
					conflict.column("rubricAssessmentId").doUpdateSet({ score: parsed }),
				)
				.execute(),
			queryDb
				.deleteFrom("booleanRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
			queryDb
				.deleteFrom("ordinalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
		]);
	}

	const result = await (async (): Promise<SaveAssessmentResult | void> => {
		switch (rubricValue.type) {
			case "boolean": {
				return await saveBooleanAssessment(rubricValue);
			}
			case "ordinal": {
				return await saveOrdinalAssessment(rubricValue);
			}
			case "numerical": {
				return await saveNumericalAssessment(rubricValue);
			}
			default: {
				return assertNever(rubricValue);
			}
		}
	})();

	if (result != null) {
		return result;
	}

	return { success: true };
}

// Saves a single assessment.
//
// A tx-accepting write command defers cache invalidation to the transaction
// owner: when a caller supplies its own transaction via `opts.db` (e.g. the bulk
// import path), this command performs NO cache work — the owner must invalidate
// after it commits. Cache invalidation must never run inside an open transaction.
// On the standalone interactive path we own the transaction and invalidate only
// after it commits.
export async function saveAssessment(
	params: SaveAssessmentParams,
	opts?: { db?: AssessmentWriteDb },
): Promise<SaveAssessmentResult> {
	if (opts?.db) {
		return applySaveAssessment(opts.db, params);
	}

	const result = await db
		.transaction()
		.execute((tx) => applySaveAssessment(tx, params));

	if (result.success) {
		updateTags(
			assessmentCacheTag(params.submissionId, params.questionId),
			CACHE_TAGS.assessments,
			assessmentQuestionCacheTag(params.questionId),
		);
	}

	return result;
}
