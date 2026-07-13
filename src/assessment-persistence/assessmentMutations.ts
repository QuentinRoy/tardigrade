import "server-only";
import type { Kysely } from "kysely";
import type { AssessmentCriterionValue } from "#criteria/types.ts";
import type { Database } from "#db/generated/database.ts";
import { assertNever } from "#utils/utils.ts";

type SubtypeTable =
	| "checkCriterionAssessment"
	| "optionsCriterionAssessment"
	| "numberCriterionAssessment";

// The two subtype tables other than the one for `keptKind`, so a criterion
// grade never carries stale values from a previous kind.
function otherSubtypeTables(
	keptKind: AssessmentCriterionValue["kind"],
): readonly SubtypeTable[] {
	switch (keptKind) {
		case "check":
			return ["optionsCriterionAssessment", "numberCriterionAssessment"];
		case "options":
			return ["checkCriterionAssessment", "numberCriterionAssessment"];
		case "number":
			return ["checkCriterionAssessment", "optionsCriterionAssessment"];
		default:
			return assertNever(keptKind);
	}
}

export type SaveAssessmentResult =
	| { success: true }
	| { success: false; error: string };

export type SaveAssessmentParams = {
	// The grade target's public id is only unique within its project (unlike
	// the old globally-unique numeric submission id), so the project must be
	// supplied explicitly rather than resolved from the target id alone
	// (CONTEXT Grid Resolution Strategy).
	projectId: string;
	targetId: string;
	rubricId: string;
	assessment: AssessmentCriterionValue;
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
	db: Kysely<Database>,
	{ projectId, targetId, rubricId, assessment }: SaveAssessmentParams,
): Promise<SaveAssessmentResult> {
	const criterionId = assessment.criterionId;

	const project = await db
		.selectFrom("project")
		.where("id", "=", projectId)
		.select("rowId")
		.executeTakeFirst();

	if (project == null) {
		return { success: false, error: assessmentErrors.contextMissing };
	}

	const target = await db
		.selectFrom("gradeTarget")
		.where("id", "=", targetId)
		.where("projectId", "=", project.rowId)
		.select("rowId")
		.executeTakeFirst();

	if (target == null) {
		return { success: false, error: assessmentErrors.contextMissing };
	}

	const rubric = await db
		.selectFrom("rubric")
		.where("id", "=", rubricId)
		.where("projectId", "=", project.rowId)
		.select(["id", "rowId", "projectId"])
		.executeTakeFirst();

	if (rubric == null) {
		return { success: false, error: assessmentErrors.contextMissing };
	}

	const criterion = await db
		.selectFrom("criterion")
		.leftJoin(
			"optionsCriterion",
			"optionsCriterion.criterionId",
			"criterion.rowId",
		)
		.leftJoin(
			"optionsCriterionMark",
			"optionsCriterionMark.optionsCriterionId",
			"optionsCriterion.id",
		)
		.leftJoin(
			"numberCriterion",
			"numberCriterion.criterionId",
			"criterion.rowId",
		)
		.where("criterion.id", "=", criterionId)
		.where("criterion.projectId", "=", rubric.projectId)
		.select([
			"criterion.id",
			"criterion.rowId",
			"criterion.kind",
			"criterion.rubricId",
			"optionsCriterionMark.label",
			"numberCriterion.minScore",
			"numberCriterion.maxScore",
		])
		.executeTakeFirst();

	if (criterion == null || criterion.rubricId !== rubric.rowId) {
		return { success: false, error: assessmentErrors.criterionMissing };
	}

	const criterionRowId = criterion.rowId;
	const gradeTargetRowId = target.rowId;

	if (criterion.kind !== assessment.kind) {
		return { success: false, error: assessmentErrors.criterionChanged };
	}

	// Upserts the criterion grade row for this (grade target, criterion) pair and
	// returns its id. Called only after the payload validates, so a failed
	// first-time save writes nothing (previously a get-or-create ran before
	// subtype validation, committing an empty grade that completion miscounted).
	async function upsertCriterionGrade(): Promise<number> {
		await db
			.insertInto("criterionAssessment")
			.values({ gradeTargetRowId, criterionId: criterionRowId })
			.onConflict((conflict) =>
				conflict.columns(["gradeTargetRowId", "criterionId"]).doNothing(),
			)
			.execute();

		const existing = await db
			.selectFrom("criterionAssessment")
			.where("gradeTargetRowId", "=", gradeTargetRowId)
			.where("criterionId", "=", criterionRowId)
			.select("id")
			.executeTakeFirstOrThrow();

		return existing.id;
	}

	async function clearOtherSubtypeValues(
		criterionAssessmentId: number,
		keptKind: AssessmentCriterionValue["kind"],
	): Promise<void> {
		await Promise.all(
			otherSubtypeTables(keptKind).map((table) =>
				db
					.deleteFrom(table)
					.where("criterionAssessmentId", "=", criterionAssessmentId)
					.execute(),
			),
		);
	}

	// Each writer validates its payload first, then persists one criterion kind's
	// value and clears the other two kinds, so a criterion never carries stale
	// values from a previous kind. A non-undefined return is a validation failure
	// that aborts the save before any write.
	async function saveBooleanAssessment(
		booleanAssessment: Extract<AssessmentCriterionValue, { kind: "check" }>,
	): Promise<SaveAssessmentResult | undefined> {
		const criterionAssessmentId = await upsertCriterionGrade();

		await Promise.all([
			db
				.insertInto("checkCriterionAssessment")
				.values({ criterionAssessmentId, passed: booleanAssessment.passed })
				.onConflict((conflict) =>
					conflict
						.column("criterionAssessmentId")
						.doUpdateSet({ passed: booleanAssessment.passed }),
				)
				.execute(),
			clearOtherSubtypeValues(criterionAssessmentId, "check"),
		]);

		return undefined;
	}

	async function saveOrdinalAssessment(
		ordinalAssessment: Extract<AssessmentCriterionValue, { kind: "options" }>,
	): Promise<SaveAssessmentResult | undefined> {
		const ordinalLabels = await db
			.selectFrom("optionsCriterionMark")
			.innerJoin(
				"optionsCriterion",
				"optionsCriterion.id",
				"optionsCriterionMark.optionsCriterionId",
			)
			.where("optionsCriterion.criterionId", "=", criterionRowId)
			.select("optionsCriterionMark.label")
			.execute();

		const allowedValues = ordinalLabels.map((item) => item.label);
		if (!allowedValues.includes(ordinalAssessment.selectedLabel)) {
			return { success: false, error: assessmentErrors.invalidOption };
		}

		const criterionAssessmentId = await upsertCriterionGrade();

		await Promise.all([
			db
				.insertInto("optionsCriterionAssessment")
				.values({
					criterionAssessmentId,
					selectedLabel: ordinalAssessment.selectedLabel,
				})
				.onConflict((conflict) =>
					conflict
						.column("criterionAssessmentId")
						.doUpdateSet({ selectedLabel: ordinalAssessment.selectedLabel }),
				)
				.execute(),
			clearOtherSubtypeValues(criterionAssessmentId, "options"),
		]);

		return undefined;
	}

	async function saveNumericalAssessment(
		numericalAssessment: Extract<AssessmentCriterionValue, { kind: "number" }>,
	): Promise<SaveAssessmentResult | undefined> {
		const parsed = numericalAssessment.score;
		if (!Number.isFinite(parsed)) {
			return { success: false, error: assessmentErrors.invalidScore };
		}

		const numberCriterionData = await db
			.selectFrom("numberCriterion")
			.where("criterionId", "=", criterionRowId)
			.select(["minScore", "maxScore"])
			.executeTakeFirst();

		const minScore =
			numberCriterionData?.minScore != null
				? Number(numberCriterionData.minScore)
				: null;
		const maxScore =
			numberCriterionData?.maxScore != null
				? Number(numberCriterionData.maxScore)
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

		const criterionAssessmentId = await upsertCriterionGrade();

		await Promise.all([
			db
				.insertInto("numberCriterionAssessment")
				.values({ criterionAssessmentId, score: parsed })
				.onConflict((conflict) =>
					conflict
						.column("criterionAssessmentId")
						.doUpdateSet({ score: parsed }),
				)
				.execute(),
			clearOtherSubtypeValues(criterionAssessmentId, "number"),
		]);

		return undefined;
	}

	const result = await ((): Promise<SaveAssessmentResult | undefined> => {
		switch (assessment.kind) {
			case "check":
				return saveBooleanAssessment(assessment);
			case "options":
				return saveOrdinalAssessment(assessment);
			case "number":
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
