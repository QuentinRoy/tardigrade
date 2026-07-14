import "server-only";
import type { Kysely } from "kysely";
import type { CriterionGrade } from "#criteria/types.ts";
import type { Database } from "#db/generated/database.ts";
import { assertNever } from "#utils/utils.ts";

// `Record<kind, ...>` forces an entry for every criterion kind: drop one and
// this stops compiling, so the mapping can't silently fall out of sync with the
// kind union.
const subtypeTableByKind = {
	check: "checkCriterionGrade",
	options: "optionsCriterionGrade",
	number: "numberCriterionGrade",
} as const satisfies Record<CriterionGrade["kind"], keyof Database>;

type SubtypeTable =
	(typeof subtypeTableByKind)[keyof typeof subtypeTableByKind];

// The two subtype tables other than the one for `keptKind`, so a criterion
// grade never carries stale values from a previous kind.
function otherSubtypeTables(
	keptKind: CriterionGrade["kind"],
): readonly SubtypeTable[] {
	return Object.entries(subtypeTableByKind)
		.filter(([kind]) => kind !== keptKind)
		.map(([, table]) => table);
}

export type SaveCriterionGradeResult =
	| { success: true }
	| { success: false; error: string };

export type SaveCriterionGradeParams = {
	// The grade target's public id is only unique within its grid (unlike
	// the old globally-unique numeric submission id), so the grid must be
	// supplied explicitly rather than resolved from the target id alone
	// (CONTEXT Grid Resolution Strategy).
	gridId: string;
	targetId: string;
	rubricId: string;
	grade: CriterionGrade;
};

export const saveCriterionGradeErrors = {
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
export async function saveCriterionGradeInDb(
	db: Kysely<Database>,
	{ gridId, targetId, rubricId, grade }: SaveCriterionGradeParams,
): Promise<SaveCriterionGradeResult> {
	const criterionId = grade.criterionId;

	const grid = await db
		.selectFrom("grid")
		.where("id", "=", gridId)
		.select("rowId")
		.executeTakeFirst();

	if (grid == null) {
		return { success: false, error: saveCriterionGradeErrors.contextMissing };
	}

	const target = await db
		.selectFrom("gradeTarget")
		.where("id", "=", targetId)
		.where("gridRowId", "=", grid.rowId)
		.select("rowId")
		.executeTakeFirst();

	if (target == null) {
		return { success: false, error: saveCriterionGradeErrors.contextMissing };
	}

	const rubric = await db
		.selectFrom("rubric")
		.where("id", "=", rubricId)
		.where("gridRowId", "=", grid.rowId)
		.select(["id", "rowId", "gridRowId"])
		.executeTakeFirst();

	if (rubric == null) {
		return { success: false, error: saveCriterionGradeErrors.contextMissing };
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
		.where("criterion.gridRowId", "=", rubric.gridRowId)
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
		return { success: false, error: saveCriterionGradeErrors.criterionMissing };
	}

	const criterionRowId = criterion.rowId;
	const gradeTargetRowId = target.rowId;

	if (criterion.kind !== grade.kind) {
		return { success: false, error: saveCriterionGradeErrors.criterionChanged };
	}

	// Upserts the criterion grade row for this (grade target, criterion) pair and
	// returns its id. Called only after the payload validates, so a failed
	// first-time save writes nothing (previously a get-or-create ran before
	// subtype validation, committing an empty grade that completion miscounted).
	async function upsertCriterionGrade(): Promise<number> {
		await db
			.insertInto("criterionGrade")
			.values({ gradeTargetRowId, criterionId: criterionRowId })
			.onConflict((conflict) =>
				conflict.columns(["gradeTargetRowId", "criterionId"]).doNothing(),
			)
			.execute();

		const existing = await db
			.selectFrom("criterionGrade")
			.where("gradeTargetRowId", "=", gradeTargetRowId)
			.where("criterionId", "=", criterionRowId)
			.select("id")
			.executeTakeFirstOrThrow();

		return existing.id;
	}

	async function clearOtherSubtypeValues(
		criterionGradeId: number,
		keptKind: CriterionGrade["kind"],
	): Promise<void> {
		await Promise.all(
			otherSubtypeTables(keptKind).map((table) =>
				db
					.deleteFrom(table)
					.where("criterionGradeId", "=", criterionGradeId)
					.execute(),
			),
		);
	}

	// Each writer validates its payload first, then persists one criterion kind's
	// value and clears the other two kinds, so a criterion never carries stale
	// values from a previous kind. A non-undefined return is a validation failure
	// that aborts the save before any write.
	async function saveBooleanGrade(
		booleanGrade: Extract<CriterionGrade, { kind: "check" }>,
	): Promise<SaveCriterionGradeResult | undefined> {
		const criterionGradeId = await upsertCriterionGrade();

		await Promise.all([
			db
				.insertInto("checkCriterionGrade")
				.values({ criterionGradeId, passed: booleanGrade.passed })
				.onConflict((conflict) =>
					conflict
						.column("criterionGradeId")
						.doUpdateSet({ passed: booleanGrade.passed }),
				)
				.execute(),
			clearOtherSubtypeValues(criterionGradeId, "check"),
		]);

		return undefined;
	}

	async function saveOrdinalGrade(
		ordinalGrade: Extract<CriterionGrade, { kind: "options" }>,
	): Promise<SaveCriterionGradeResult | undefined> {
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
		if (!allowedValues.includes(ordinalGrade.selectedLabel)) {
			return { success: false, error: saveCriterionGradeErrors.invalidOption };
		}

		const criterionGradeId = await upsertCriterionGrade();

		await Promise.all([
			db
				.insertInto("optionsCriterionGrade")
				.values({ criterionGradeId, selectedLabel: ordinalGrade.selectedLabel })
				.onConflict((conflict) =>
					conflict
						.column("criterionGradeId")
						.doUpdateSet({ selectedLabel: ordinalGrade.selectedLabel }),
				)
				.execute(),
			clearOtherSubtypeValues(criterionGradeId, "options"),
		]);

		return undefined;
	}

	async function saveNumericalGrade(
		numericalGrade: Extract<CriterionGrade, { kind: "number" }>,
	): Promise<SaveCriterionGradeResult | undefined> {
		const parsed = numericalGrade.score;
		if (!Number.isFinite(parsed)) {
			return { success: false, error: saveCriterionGradeErrors.invalidScore };
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
			return {
				success: false,
				error: saveCriterionGradeErrors.invalidScoreRange,
			};
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

		const criterionGradeId = await upsertCriterionGrade();

		await Promise.all([
			db
				.insertInto("numberCriterionGrade")
				.values({ criterionGradeId, score: parsed })
				.onConflict((conflict) =>
					conflict.column("criterionGradeId").doUpdateSet({ score: parsed }),
				)
				.execute(),
			clearOtherSubtypeValues(criterionGradeId, "number"),
		]);

		return undefined;
	}

	const result = await ((): Promise<SaveCriterionGradeResult | undefined> => {
		switch (grade.kind) {
			case "check":
				return saveBooleanGrade(grade);
			case "options":
				return saveOrdinalGrade(grade);
			case "number":
				return saveNumericalGrade(grade);
			default:
				return assertNever(grade);
		}
	})();

	if (result != null) {
		return result;
	}

	return { success: true };
}
