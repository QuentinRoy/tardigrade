import "server-only";
import type { Transaction } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { GradeValidationResult } from "../types.ts";
import type {
	OptionsCriterion,
	OptionsCriterionGradeContent,
	OptionsMarks,
} from "./optionsDomain.ts";

// Server-only persistence adapters for the Options criterion kind: batched
// definition-subtype upsert (with stale-mark reconciliation), grade-subtype
// write, and row→config read mapping (ADR 0013). `db` is a caller-supplied
// transaction; these are write primitives and cannot run on the global client.

export type OptionsSubtypeRow = { criterionRowId: number; marks: OptionsMarks };

// Batched upsert of Options definition subtype rows. The coordinator resolves
// each `criterionRowId` and groups by kind before calling this.
//
// Unlike Check and Number, an Options criterion's marks live in a child table
// keyed by label, so re-saving with a label removed must delete the row that
// label left behind. Marks are therefore reconciled, not just upserted: every
// mark row not named by the incoming marks is stale and deleted before the
// insert. `optionsCriterion` is keyed directly by `criterionRowId`, so
// `optionsCriterionMark` targets it without an intermediate id lookup.
export async function upsertOptionsSubtypeRowsInDb(
	db: Transaction<Database>,
	rows: OptionsSubtypeRow[],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await db
		.insertInto("optionsCriterion")
		.values(rows.map((row) => ({ criterionRowId: row.criterionRowId })))
		.onConflict((conflict) => conflict.column("criterionRowId").doNothing())
		.execute();

	const criterionRowIds = rows.map((row) => row.criterionRowId);

	const existingOptionsValues = await db
		.selectFrom("optionsCriterionMark")
		.select(["rowId", "criterionRowId", "label"])
		.where("criterionRowId", "in", criterionRowIds)
		.execute();

	const validLabelsByCriterionRowId = new Map(
		rows.map((row) => [row.criterionRowId, new Set(Object.keys(row.marks))]),
	);

	const staleRowIds = existingOptionsValues
		.filter(
			(value) =>
				!validLabelsByCriterionRowId
					.get(value.criterionRowId)
					?.has(value.label),
		)
		.map((value) => value.rowId);

	if (staleRowIds.length > 0) {
		await db
			.deleteFrom("optionsCriterionMark")
			.where("rowId", "in", staleRowIds)
			.execute();
	}

	const optionsValueRows = rows.flatMap((row) =>
		Object.entries(row.marks).map(([label, markValue]) => ({
			criterionRowId: row.criterionRowId,
			label,
			marks: markValue,
		})),
	);

	if (optionsValueRows.length > 0) {
		await db
			.insertInto("optionsCriterionMark")
			.values(optionsValueRows)
			.onConflict((conflict) =>
				conflict
					.columns(["criterionRowId", "label"])
					.doUpdateSet((eb) => ({ marks: eb.ref("excluded.marks") })),
			)
			.execute();
	}
}

// User-facing message for an Options grade selecting a label the criterion no
// longer offers (ADR 0013: kind owns the fact and the message; grade-persistence
// keeps only messages that aren't kind-specific).
const optionsInvalidLabelMessage =
	"That option is no longer available. Reload and choose another option.";

// Pure per-row rule shared by the single-row and batch validators, so both call
// shapes enforce the exact same policy against a caller-resolved label set.
function checkOptionsGradeAgainstLabels({
	grade,
	allowedLabels,
}: {
	grade: OptionsCriterionGradeContent;
	allowedLabels: Set<string> | undefined;
}): GradeValidationResult {
	if (allowedLabels == null || !allowedLabels.has(grade.selectedLabel)) {
		return { valid: false, message: optionsInvalidLabelMessage };
	}

	return { valid: true };
}

// Batch-resolves every distinct criterion's currently offered labels in one
// query, then validates each row against its own criterion's labels (ADR 0013
// pinned adapter signature, generalized to a batch). The coordinator calls this
// before upserting any parent `criterionGrade` row, so a batch containing an
// invalid Options grade writes nothing. Results are returned in the same order
// as `rows`.
export async function validateOptionsGradesInDb(
	db: Transaction<Database>,
	rows: { criterionRowId: number; grade: OptionsCriterionGradeContent }[],
): Promise<GradeValidationResult[]> {
	if (rows.length === 0) {
		return [];
	}

	const optionsLabelRows = await db
		.selectFrom("optionsCriterionMark")
		.where("criterionRowId", "in", [
			...new Set(rows.map((row) => row.criterionRowId)),
		])
		.select(["criterionRowId", "label"])
		.execute();

	const allowedLabelsByCriterionRowId = new Map<number, Set<string>>();
	for (const row of optionsLabelRows) {
		const labels = allowedLabelsByCriterionRowId.get(row.criterionRowId);
		if (labels == null) {
			allowedLabelsByCriterionRowId.set(
				row.criterionRowId,
				new Set([row.label]),
			);
		} else {
			labels.add(row.label);
		}
	}

	return rows.map(({ criterionRowId, grade }) =>
		checkOptionsGradeAgainstLabels({
			grade,
			allowedLabels: allowedLabelsByCriterionRowId.get(criterionRowId),
		}),
	);
}

// Validates an Options grade against the criterion's current marks (ADR 0013
// pinned adapter signature: validate(db, { criterionRowId, grade })). Delegates
// to the batch validator with a one-row input so single- and multi-grade
// callers share one rule.
export async function validateOptionsGradeInDb(
	db: Transaction<Database>,
	params: { criterionRowId: number; grade: OptionsCriterionGradeContent },
): Promise<GradeValidationResult> {
	const [result] = await validateOptionsGradesInDb(db, [params]);
	if (result == null) {
		throw new Error("Expected validateOptionsGradesInDb to return one result.");
	}
	return result;
}

// Batched write of Options criterion grades' subtype rows. The coordinator
// validates the selected labels against each criterion's marks and upserts the
// parent `criterionGrade` rows first, so this never runs before the parent
// rows exist.
export async function writeOptionsGradesInDb(
	db: Transaction<Database>,
	rows: {
		gradeTargetRowId: number;
		criterionRowId: number;
		grade: OptionsCriterionGradeContent;
	}[],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await db
		.insertInto("optionsCriterionGrade")
		.values(
			rows.map((row) => ({
				gradeTargetRowId: row.gradeTargetRowId,
				criterionRowId: row.criterionRowId,
				selectedLabel: row.grade.selectedLabel,
			})),
		)
		.onConflict((conflict) =>
			conflict
				.columns(["gradeTargetRowId", "criterionRowId"])
				.doUpdateSet((eb) => ({
					selectedLabel: eb.ref("excluded.selectedLabel"),
				})),
		)
		.execute();
}

// Maps a loaded criterion row (base fields + the joined Options mark rows) to the
// canonical `OptionsCriterion` config. The exhaustive `toCriterion` dispatcher
// delegates its `options` branch here.
export function toOptionsCriterion(data: {
	id: string;
	description: string | null;
	label: string | null;
	optionsCriterion: { marks: { label: string; marks: number }[] } | null;
}): OptionsCriterion {
	if (data.optionsCriterion == null) {
		throw new Error(
			`Criterion Subtype Invariant violation: missing optionsCriterion row for criterion ${data.id}.`,
		);
	}

	return {
		id: data.id,
		description: data.description ?? undefined,
		label: data.label ?? undefined,
		kind: "options",
		marks: Object.fromEntries(
			data.optionsCriterion.marks.map((item) => [item.label, item.marks]),
		),
	};
}
