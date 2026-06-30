import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import type { AssessmentRubricValue } from "#rubrics/types.ts";
import { assertNever } from "#utils/utils.ts";

export type SaveAssessmentResult =
	| { success: true }
	| { success: false; error: string };

export type SaveAssessmentParams = {
	submissionId: string;
	questionId: string;
	assessment: AssessmentRubricValue;
};

export const assessmentErrors = {
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
	unexpected:
		"Something went wrong saving this grade. Reload and try again. If this keeps happening, report this issue.",
};

// Performs all validation + persistence against the given db. No cache work.
// The db is either the global client or a caller-supplied transaction.
export async function saveAssessmentInDb(
	db: Kysely<DB>,
	{ submissionId, questionId, assessment }: SaveAssessmentParams,
): Promise<SaveAssessmentResult> {
	const rubricId = assessment.rubricId;

	const submission = await db
		.selectFrom("submission")
		.where("id", "=", Number(submissionId))
		.select(["id", "projectId"])
		.executeTakeFirst();

	if (submission == null) {
		return { success: false, error: assessmentErrors.contextMissing };
	}

	const question = await db
		.selectFrom("question")
		.where("id", "=", questionId)
		.where("projectId", "=", submission.projectId)
		.select(["id", "rowId", "projectId"])
		.executeTakeFirst();

	if (question == null) {
		return { success: false, error: assessmentErrors.contextMissing };
	}

	const rubric = await db
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

	if (rubric.type !== assessment.type) {
		return { success: false, error: assessmentErrors.criterionChanged };
	}

	await db
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

	const existingAssessment = await db
		.selectFrom("assessment")
		.where("submissionId", "=", submission.id)
		.where("questionId", "=", question.rowId)
		.select("id")
		.executeTakeFirstOrThrow();

	const assessmentId = existingAssessment.id;

	await db
		.insertInto("rubricAssessment")
		.values({ assessmentId, rubricId: rubricRowId, type: assessment.type })
		.onConflict((conflict) =>
			conflict
				.columns(["assessmentId", "rubricId"])
				.doUpdateSet({ type: assessment.type }),
		)
		.execute();

	const existingRubricAssessment = await db
		.selectFrom("rubricAssessment")
		.where("assessmentId", "=", assessmentId)
		.where("rubricId", "=", rubricRowId)
		.select("id")
		.executeTakeFirstOrThrow();

	const rubricAssessmentId = existingRubricAssessment.id;

	// Each writer persists one rubric type's value and clears the other two
	// types, so a rubric never carries stale values from a previous type. A
	// non-undefined return is a validation failure that aborts the save.
	async function saveBooleanAssessment(
		booleanAssessment: Extract<AssessmentRubricValue, { type: "boolean" }>,
	): Promise<SaveAssessmentResult | undefined> {
		await Promise.all([
			db
				.insertInto("booleanRubricAssessment")
				.values({ rubricAssessmentId, passed: booleanAssessment.passed })
				.onConflict((conflict) =>
					conflict
						.column("rubricAssessmentId")
						.doUpdateSet({ passed: booleanAssessment.passed }),
				)
				.execute(),
			db
				.deleteFrom("ordinalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
			db
				.deleteFrom("numericalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
		]);

		return undefined;
	}

	async function saveOrdinalAssessment(
		ordinalAssessment: Extract<AssessmentRubricValue, { type: "ordinal" }>,
	): Promise<SaveAssessmentResult | undefined> {
		const ordinalLabels = await db
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
		if (!allowedValues.includes(ordinalAssessment.selectedLabel)) {
			return { success: false, error: assessmentErrors.invalidOption };
		}

		await Promise.all([
			db
				.insertInto("ordinalRubricAssessment")
				.values({
					rubricAssessmentId,
					selectedLabel: ordinalAssessment.selectedLabel,
				})
				.onConflict((conflict) =>
					conflict
						.column("rubricAssessmentId")
						.doUpdateSet({ selectedLabel: ordinalAssessment.selectedLabel }),
				)
				.execute(),
			db
				.deleteFrom("booleanRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
			db
				.deleteFrom("numericalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
		]);

		return undefined;
	}

	async function saveNumericalAssessment(
		numericalAssessment: Extract<AssessmentRubricValue, { type: "numerical" }>,
	): Promise<SaveAssessmentResult | undefined> {
		const parsed = numericalAssessment.score;
		if (!Number.isFinite(parsed)) {
			return { success: false, error: assessmentErrors.invalidScore };
		}

		const numericalRubricData = await db
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
			db
				.insertInto("numericalRubricAssessment")
				.values({ rubricAssessmentId, score: parsed })
				.onConflict((conflict) =>
					conflict.column("rubricAssessmentId").doUpdateSet({ score: parsed }),
				)
				.execute(),
			db
				.deleteFrom("booleanRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
			db
				.deleteFrom("ordinalRubricAssessment")
				.where("rubricAssessmentId", "=", rubricAssessmentId)
				.execute(),
		]);

		return undefined;
	}

	const result = await ((): Promise<SaveAssessmentResult | undefined> => {
		switch (assessment.type) {
			case "boolean":
				return saveBooleanAssessment(assessment);
			case "ordinal":
				return saveOrdinalAssessment(assessment);
			case "numerical":
				return saveNumericalAssessment(assessment);
			default:
				return assertNever(assessment);
		}
	})();

	if (result != null) {
		return result;
	}

	return { success: true };
}
