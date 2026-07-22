import "server-only";
import type { Transaction } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { GradeValidationResult } from "../types.ts";
import { isNumberValueRangeValid } from "./numberBounds.ts";
import type {
	NumberCriterion,
	NumberCriterionGradeContent,
} from "./numberDomain.ts";

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

type NumberBounds = { minValue: number; maxValue: number };

// Pure per-row rule shared by the single-row and batch validators, so both call
// shapes enforce the exact same policy against a caller-resolved bounds context.
function checkNumberGradeAgainstBounds({
	grade,
	bounds,
}: {
	grade: NumberCriterionGradeContent;
	bounds: NumberBounds | null;
}): GradeValidationResult {
	if (!Number.isFinite(grade.value)) {
		return { valid: false, message: numberInvalidValueMessage };
	}

	if (bounds == null || !isNumberValueRangeValid(bounds)) {
		return { valid: false, message: numberInvalidValueRangeMessage };
	}

	if (grade.value < bounds.minValue) {
		return {
			valid: false,
			message: `Enter a value of at least ${bounds.minValue}.`,
		};
	}
	if (grade.value > bounds.maxValue) {
		return {
			valid: false,
			message: `Enter a value of at most ${bounds.maxValue}.`,
		};
	}

	return { valid: true };
}

// Batch-resolves every distinct criterion's value range in one query, then
// validates each row against its own criterion's bounds (ADR 0013 pinned
// adapter signature, generalized to a batch). The coordinator calls this before
// upserting any parent `criterionGrade` row, so a batch containing an invalid
// Number grade writes nothing. Results are returned in the same order as `rows`.
export async function validateNumberGradesInDb(
	db: Transaction<Database>,
	rows: { criterionRowId: number; grade: NumberCriterionGradeContent }[],
): Promise<GradeValidationResult[]> {
	if (rows.length === 0) {
		return [];
	}

	const numberCriterionRows = await db
		.selectFrom("numberCriterion")
		.where("criterionId", "in", [
			...new Set(rows.map((row) => row.criterionRowId)),
		])
		.select(["criterionId", "minValue", "maxValue"])
		.execute();

	const boundsByCriterionRowId = new Map<number, NumberBounds | null>(
		numberCriterionRows.map((row) => [
			row.criterionId,
			row.minValue != null && row.maxValue != null
				? { minValue: Number(row.minValue), maxValue: Number(row.maxValue) }
				: null,
		]),
	);

	return rows.map(({ criterionRowId, grade }) =>
		checkNumberGradeAgainstBounds({
			grade,
			bounds: boundsByCriterionRowId.get(criterionRowId) ?? null,
		}),
	);
}

// Validates a Number grade against the criterion's current value range
// (ADR 0013 pinned adapter signature: validate(db, { criterionRowId, grade })).
// Delegates to the batch validator with a one-row input so single- and
// multi-grade callers share one rule.
export async function validateNumberGradeInDb(
	db: Transaction<Database>,
	params: { criterionRowId: number; grade: NumberCriterionGradeContent },
): Promise<GradeValidationResult> {
	const [result] = await validateNumberGradesInDb(db, [params]);
	if (result == null) {
		throw new Error("Expected validateNumberGradesInDb to return one result.");
	}
	return result;
}

// Batched write of Number criterion grades' subtype rows. The coordinator
// upserts the parent `criterionGrade` rows and passes their ids, so this never
// runs before the parent rows exist.
export async function writeNumberGradesInDb(
	db: Transaction<Database>,
	rows: { criterionGradeId: number; grade: NumberCriterionGradeContent }[],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await db
		.insertInto("numberCriterionGrade")
		.values(
			rows.map((row) => ({
				criterionGradeId: row.criterionGradeId,
				value: row.grade.value,
			})),
		)
		.onConflict((conflict) =>
			conflict
				.column("criterionGradeId")
				.doUpdateSet((eb) => ({ value: eb.ref("excluded.value") })),
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
