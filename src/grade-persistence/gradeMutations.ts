import "server-only";
import type { Transaction } from "kysely";
import { writeCheckGradeInDb } from "#criteria/check/checkPersistence.ts";
import { isNumberValueRangeValid } from "#criteria/number/numberBounds.ts";
import { writeNumberGradeInDb } from "#criteria/number/numberPersistence.ts";
import { writeOptionsGradeInDb } from "#criteria/options/optionsPersistence.ts";
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
	invalidValue: "Enter a valid value and try again.",
	invalidValueRange:
		"This value range is currently unavailable. Reload and try again. If it still fails, report this issue.",
	unexpected:
		"Something went wrong saving this grade. Reload and try again. If this keeps happening, report this issue.",
};

// Performs all validation + persistence against the given db. No cache work.
// The db is a caller-supplied transaction; this write primitive cannot run on
// the global client.
export async function saveCriterionGradeInDb(
	db: Transaction<Database>,
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
			"numberCriterion.minValue",
			"numberCriterion.maxValue",
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
	async function saveCheckGrade(
		checkGrade: Extract<CriterionGrade, { kind: "check" }>,
	): Promise<SaveCriterionGradeResult | undefined> {
		const criterionGradeId = await upsertCriterionGrade();

		await Promise.all([
			writeCheckGradeInDb(db, criterionGradeId, { passed: checkGrade.passed }),
			clearOtherSubtypeValues(criterionGradeId, "check"),
		]);

		return undefined;
	}

	async function saveOptionsGrade(
		optionsGrade: Extract<CriterionGrade, { kind: "options" }>,
	): Promise<SaveCriterionGradeResult | undefined> {
		const optionsLabels = await db
			.selectFrom("optionsCriterionMark")
			.innerJoin(
				"optionsCriterion",
				"optionsCriterion.id",
				"optionsCriterionMark.optionsCriterionId",
			)
			.where("optionsCriterion.criterionId", "=", criterionRowId)
			.select("optionsCriterionMark.label")
			.execute();

		const allowedValues = optionsLabels.map((item) => item.label);
		if (!allowedValues.includes(optionsGrade.selectedLabel)) {
			return { success: false, error: saveCriterionGradeErrors.invalidOption };
		}

		const criterionGradeId = await upsertCriterionGrade();

		await Promise.all([
			writeOptionsGradeInDb(db, criterionGradeId, {
				selectedLabel: optionsGrade.selectedLabel,
			}),
			clearOtherSubtypeValues(criterionGradeId, "options"),
		]);

		return undefined;
	}

	async function saveNumberGrade(
		numberGrade: Extract<CriterionGrade, { kind: "number" }>,
	): Promise<SaveCriterionGradeResult | undefined> {
		const parsed = numberGrade.value;
		if (!Number.isFinite(parsed)) {
			return { success: false, error: saveCriterionGradeErrors.invalidValue };
		}

		const numberCriterionData = await db
			.selectFrom("numberCriterion")
			.where("criterionId", "=", criterionRowId)
			.select(["minValue", "maxValue"])
			.executeTakeFirst();

		const minValue =
			numberCriterionData?.minValue != null
				? Number(numberCriterionData.minValue)
				: null;
		const maxValue =
			numberCriterionData?.maxValue != null
				? Number(numberCriterionData.maxValue)
				: null;

		if (
			minValue == null ||
			maxValue == null ||
			!isNumberValueRangeValid({ minValue, maxValue })
		) {
			return {
				success: false,
				error: saveCriterionGradeErrors.invalidValueRange,
			};
		}

		if (parsed < minValue) {
			return {
				success: false,
				error: `Enter a value of at least ${minValue}.`,
			};
		}
		if (parsed > maxValue) {
			return { success: false, error: `Enter a value of at most ${maxValue}.` };
		}

		const criterionGradeId = await upsertCriterionGrade();

		await Promise.all([
			writeNumberGradeInDb(db, criterionGradeId, { value: parsed }),
			clearOtherSubtypeValues(criterionGradeId, "number"),
		]);

		return undefined;
	}

	const result = await ((): Promise<SaveCriterionGradeResult | undefined> => {
		switch (grade.kind) {
			case "check":
				return saveCheckGrade(grade);
			case "options":
				return saveOptionsGrade(grade);
			case "number":
				return saveNumberGrade(grade);
			default:
				return assertNever(grade);
		}
	})();

	if (result != null) {
		return result;
	}

	return { success: true };
}
