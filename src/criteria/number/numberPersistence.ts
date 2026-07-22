import "server-only";
import type { Transaction } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { GradeValidationResult } from "../types.ts";
import { isNumberValueRangeValid } from "./numberBounds.ts";
import type {
	NumberCriterion,
	NumberCriterionGradeContent,
} from "./numberDomain.ts";
import { getNumberGradeBoundsError } from "./numberDomain.ts";

// Server-only persistence adapters for the Number criterion kind: batched
// definition-subtype upsert, grade-subtype write, and row→config read mapping
// (ADR 0013). `db` is a caller-supplied transaction; these are write primitives
// and cannot run on the global client.

export type NumberSubtypeRow = {
	criterionRowId: number;
	minValue: number;
	maxValue: number;
	minMarks: number;
	maxMarks: number;
	reversed: boolean;
};

// Batched upsert of Number definition subtype rows. The coordinator resolves each
// `criterionRowId` and groups by kind before calling this.
export async function upsertNumberSubtypeRowsInDb(
	db: Transaction<Database>,
	rows: NumberSubtypeRow[],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await db
		.insertInto("numberCriterion")
		.values(
			rows.map((row) => ({
				criterionId: row.criterionRowId,
				minValue: row.minValue,
				maxValue: row.maxValue,
				minMarks: row.minMarks,
				maxMarks: row.maxMarks,
				reversed: row.reversed,
			})),
		)
		.onConflict((conflict) =>
			conflict
				.column("criterionId")
				.doUpdateSet((eb) => ({
					minValue: eb.ref("excluded.minValue"),
					maxValue: eb.ref("excluded.maxValue"),
					minMarks: eb.ref("excluded.minMarks"),
					maxMarks: eb.ref("excluded.maxMarks"),
					reversed: eb.ref("excluded.reversed"),
				})),
		)
		.execute();
}

// User-facing messages for a Number grade (ADR 0013: kind owns the fact and the
// message; grade-persistence keeps only messages that aren't kind-specific).
const numberInvalidValueMessage = "Enter a valid value and try again.";
const numberInvalidValueRangeMessage =
	"This value range is currently unavailable. Reload and try again. If it still fails, report this issue.";

// Validates a Number grade against the criterion's current value range
// (ADR 0013 pinned adapter signature: validate(db, { criterionRowId, grade })).
// The coordinator calls this before upserting the parent `criterionGrade` row.
export async function validateNumberGradeInDb(
	db: Transaction<Database>,
	{
		criterionRowId,
		grade,
	}: { criterionRowId: number; grade: NumberCriterionGradeContent },
): Promise<GradeValidationResult> {
	if (!Number.isFinite(grade.value)) {
		return { valid: false, message: numberInvalidValueMessage };
	}

	const numberCriterionRow = await db
		.selectFrom("numberCriterion")
		.where("criterionId", "=", criterionRowId)
		.select(["minValue", "maxValue"])
		.executeTakeFirst();

	const minValue =
		numberCriterionRow?.minValue != null
			? Number(numberCriterionRow.minValue)
			: null;
	const maxValue =
		numberCriterionRow?.maxValue != null
			? Number(numberCriterionRow.maxValue)
			: null;

	if (
		minValue == null ||
		maxValue == null ||
		!isNumberValueRangeValid({ minValue, maxValue })
	) {
		return { valid: false, message: numberInvalidValueRangeMessage };
	}

	const boundsError = getNumberGradeBoundsError({
		...grade,
		minValue,
		maxValue,
	});
	if (boundsError != null) {
		return { valid: false, message: boundsError };
	}

	return { valid: true };
}

// Writes a Number criterion grade's subtype row. The coordinator upserts the
// parent `criterionGrade` and passes its id, so this never runs before the
// parent row exists.
export async function writeNumberGradeInDb(
	db: Transaction<Database>,
	{
		criterionGradeId,
		grade,
	}: { criterionGradeId: number; grade: NumberCriterionGradeContent },
): Promise<void> {
	await db
		.insertInto("numberCriterionGrade")
		.values({ criterionGradeId, value: grade.value })
		.onConflict((conflict) =>
			conflict.column("criterionGradeId").doUpdateSet({ value: grade.value }),
		)
		.execute();
}

// Maps a loaded criterion row (base fields + the joined Number subtype row) to
// the canonical `NumberCriterion` config. The exhaustive `toCriterion` dispatcher
// delegates its `number` branch here.
export function toNumberCriterion(data: {
	id: string;
	description: string | null;
	label: string | null;
	numberCriterion: {
		minValue: number;
		maxValue: number;
		minMarks: number;
		maxMarks: number;
		reversed: boolean;
	} | null;
}): NumberCriterion {
	if (data.numberCriterion == null) {
		throw new Error(
			`Criterion Subtype Invariant violation: missing numberCriterion row for criterion ${data.id}.`,
		);
	}

	return {
		id: data.id,
		description: data.description ?? undefined,
		label: data.label ?? undefined,
		kind: "number",
		minValue: data.numberCriterion.minValue,
		maxValue: data.numberCriterion.maxValue,
		minMarks: data.numberCriterion.minMarks,
		maxMarks: data.numberCriterion.maxMarks,
		reversed: data.numberCriterion.reversed,
	};
}
