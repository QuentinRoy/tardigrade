import "server-only";
import type { Transaction } from "kysely";
import type { CheckCriterionGradeContent } from "#criteria/check/checkDomain.ts";
import { writeCheckGradesInDb } from "#criteria/check/checkPersistence.ts";
import type { NumberCriterionGradeContent } from "#criteria/number/numberDomain.ts";
import {
	validateNumberGradesInDb,
	writeNumberGradesInDb,
} from "#criteria/number/numberPersistence.ts";
import type { OptionsCriterionGradeContent } from "#criteria/options/optionsDomain.ts";
import {
	validateOptionsGradesInDb,
	writeOptionsGradesInDb,
} from "#criteria/options/optionsPersistence.ts";
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

// One item of a Grid-scoped batch write: the grade plus the target/rubric
// context needed to resolve it (CONTEXT Grid Resolution Strategy — the grid
// itself is supplied once for the whole batch, not repeated per item).
export type CriterionGradeWrite = {
	targetId: string;
	rubricId: string;
	grade: CriterionGrade;
};

export type SaveCriterionGradeParams = CriterionGradeWrite & {
	// The grade target's public id is only unique within its grid (unlike
	// the old globally-unique numeric submission id), so the grid must be
	// supplied explicitly rather than resolved from the target id alone
	// (CONTEXT Grid Resolution Strategy).
	gridId: string;
};

export type SaveCriterionGradesParams = {
	gridId: string;
	grades: CriterionGradeWrite[];
};

export const saveCriterionGradeErrors = {
	contextMissing:
		"We couldn't match this grade to the selected student work. Reload and try again. If this keeps happening, report this issue.",
	criterionMissing:
		"We couldn't find this grading criterion. Reload and try again. If this keeps happening, report this issue.",
	criterionChanged:
		"This grading criterion changed while you were grading. Reload and try again.",
	unexpected:
		"Something went wrong saving this grade. Reload and try again. If this keeps happening, report this issue.",
};

// One resolved batch entry: the grade plus its internal row ids, once the
// public (target, rubric, criterion) ids have been matched against the grid.
type ResolvedGradeWrite = {
	gradeTargetRowId: number;
	criterionRowId: number;
	grade: CriterionGrade;
};

// Per-kind subtype write rows, once a resolved grade's parent `criterionGrade`
// row id is known.
type CheckGradeWriteRow = {
	criterionGradeId: number;
	grade: CheckCriterionGradeContent;
};
type OptionsGradeWriteRow = {
	criterionGradeId: number;
	grade: OptionsCriterionGradeContent;
};
type NumberGradeWriteRow = {
	criterionGradeId: number;
	grade: NumberCriterionGradeContent;
};

// Resolves every write's (grade target, rubric, criterion) context against the
// grid in one set-based query per entity, instead of repeating the lookup
// sequence per grade. Returns the first defensive domain failure found in write
// order. A repeated Grade Target + Criterion pair is a caller invariant breach,
// so it throws with internal identifiers rather than returning user-facing copy.
async function resolveGradeWrites(
	db: Transaction<Database>,
	{ gridRowId, grades }: { gridRowId: number; grades: CriterionGradeWrite[] },
): Promise<
	| { success: true; resolved: ResolvedGradeWrite[] }
	| { success: false; error: string }
> {
	const [targetRows, rubricRows, criterionRows] = await Promise.all([
		db
			.selectFrom("gradeTarget")
			.where("gridRowId", "=", gridRowId)
			.where("id", "in", [...new Set(grades.map((write) => write.targetId))])
			.select(["id", "rowId"])
			.execute(),
		db
			.selectFrom("rubric")
			.where("gridRowId", "=", gridRowId)
			.where("id", "in", [...new Set(grades.map((write) => write.rubricId))])
			.select(["id", "rowId"])
			.execute(),
		db
			.selectFrom("criterion")
			.where("gridRowId", "=", gridRowId)
			.where("id", "in", [
				...new Set(grades.map((write) => write.grade.criterionId)),
			])
			.select(["id", "rowId", "kind", "rubricId"])
			.execute(),
	]);

	const targetRowIdById = new Map(targetRows.map((row) => [row.id, row.rowId]));
	const rubricRowIdById = new Map(rubricRows.map((row) => [row.id, row.rowId]));
	const criterionById = new Map(criterionRows.map((row) => [row.id, row]));

	const resolved: ResolvedGradeWrite[] = [];
	const firstWriteIndexByTargetCriterionPair = new Map<string, number>();

	for (const [writeIndex, write] of grades.entries()) {
		const gradeTargetRowId = targetRowIdById.get(write.targetId);
		const rubricRowId = rubricRowIdById.get(write.rubricId);
		if (gradeTargetRowId == null || rubricRowId == null) {
			return { success: false, error: saveCriterionGradeErrors.contextMissing };
		}

		const criterion = criterionById.get(write.grade.criterionId);
		if (criterion == null || criterion.rubricId !== rubricRowId) {
			return {
				success: false,
				error: saveCriterionGradeErrors.criterionMissing,
			};
		}

		if (criterion.kind !== write.grade.kind) {
			return {
				success: false,
				error: saveCriterionGradeErrors.criterionChanged,
			};
		}

		const pairKey = `${gradeTargetRowId}:${criterion.rowId}`;
		const firstWriteIndex = firstWriteIndexByTargetCriterionPair.get(pairKey);
		if (firstWriteIndex != null) {
			throw new Error(
				`Duplicate criterion Grade writes at batch indexes ${firstWriteIndex} and ${writeIndex} for Grade Target Row ID ${gradeTargetRowId} and Criterion Row ID ${criterion.rowId}.`,
			);
		}
		firstWriteIndexByTargetCriterionPair.set(pairKey, writeIndex);

		resolved.push({
			gradeTargetRowId,
			criterionRowId: criterion.rowId,
			grade: write.grade,
		});
	}

	return { success: true, resolved };
}

// Upserts the parent `criterionGrade` rows for every resolved write in one
// bounded insert, then reads back their ids. Called only after every write in
// the batch validates, so a batch containing any invalid grade writes nothing
// (previously a get-or-create ran before subtype validation per grade,
// committing an empty grade that completion miscounted).
async function upsertCriterionGradeParents(
	db: Transaction<Database>,
	{
		gridRowId,
		resolved,
	}: { gridRowId: number; resolved: ResolvedGradeWrite[] },
): Promise<Map<string, number>> {
	// gridRowId is a consistency copy backstopped by the composite FKs on
	// criterion_id and grade_target_row_id (ADR 0015): the grid-scoped lookups
	// in resolveGradeWrites remain for id-resolution and user-facing errors, not
	// for cross-grid integrity, which the DB now enforces.
	await db
		.insertInto("criterionGrade")
		.values(
			resolved.map((entry) => ({
				gradeTargetRowId: entry.gradeTargetRowId,
				criterionId: entry.criterionRowId,
				gridRowId,
			})),
		)
		.onConflict((conflict) =>
			conflict.columns(["gradeTargetRowId", "criterionId"]).doNothing(),
		)
		.execute();

	const parentRows = await db
		.selectFrom("criterionGrade")
		.where("gradeTargetRowId", "in", [
			...new Set(resolved.map((entry) => entry.gradeTargetRowId)),
		])
		.where("criterionId", "in", [
			...new Set(resolved.map((entry) => entry.criterionRowId)),
		])
		.select(["id", "gradeTargetRowId", "criterionId"])
		.execute();

	return new Map(
		parentRows.map((row) => [
			`${row.gradeTargetRowId}:${row.criterionId}`,
			row.id,
		]),
	);
}

// Deletes the two subtype tables a kept kind does not use, one group per kind
// actually written, so a batch clears stale values in a handful of bounded
// statements rather than per grade.
function clearStaleSubtypeValues(
	db: Transaction<Database>,
	criterionGradeIdsByKind: Record<CriterionGrade["kind"], number[]>,
): Promise<unknown>[] {
	function clearKind(kind: CriterionGrade["kind"]): Promise<unknown>[] {
		const criterionGradeIds = criterionGradeIdsByKind[kind];
		if (criterionGradeIds.length === 0) {
			return [];
		}
		return otherSubtypeTables(kind).map((table) =>
			db
				.deleteFrom(table)
				.where("criterionGradeId", "in", criterionGradeIds)
				.execute(),
		);
	}

	return [
		...clearKind("check"),
		...clearKind("options"),
		...clearKind("number"),
	];
}

// Performs all validation + persistence for a Grid-scoped batch of Check,
// Options, and Number grades against the given db. Resolves the Grid once,
// then the Grade Targets, Rubrics, and Criteria in one set-based query each,
// regardless of batch size. No cache work. The db is a caller-supplied
// transaction; this write primitive cannot run on the global client.
export async function saveCriterionGradesInDb(
	db: Transaction<Database>,
	{ gridId, grades }: SaveCriterionGradesParams,
): Promise<SaveCriterionGradeResult> {
	if (grades.length === 0) {
		return { success: true };
	}

	const grid = await db
		.selectFrom("grid")
		.where("id", "=", gridId)
		.select("rowId")
		.executeTakeFirst();

	if (grid == null) {
		return { success: false, error: saveCriterionGradeErrors.contextMissing };
	}
	const gridRowId = grid.rowId;

	const resolution = await resolveGradeWrites(db, { gridRowId, grades });
	if (!resolution.success) {
		return resolution;
	}
	const { resolved } = resolution;

	// Kind-specific validation context (Number bounds, Options labels) is also
	// resolved per kind in one query across every grade of that kind, not once
	// per grade. A batch containing any invalid grade writes nothing: both
	// validation passes run, and any failure returns before the writes below.
	const numberGradeInputs: {
		criterionRowId: number;
		grade: NumberCriterionGradeContent;
	}[] = [];
	const optionsGradeInputs: {
		criterionRowId: number;
		grade: OptionsCriterionGradeContent;
	}[] = [];
	for (const entry of resolved) {
		switch (entry.grade.kind) {
			case "number":
				numberGradeInputs.push({
					criterionRowId: entry.criterionRowId,
					grade: { value: entry.grade.value },
				});
				break;
			case "options":
				optionsGradeInputs.push({
					criterionRowId: entry.criterionRowId,
					grade: { selectedLabel: entry.grade.selectedLabel },
				});
				break;
			case "check":
				break;
			default:
				assertNever(entry.grade);
		}
	}

	const [numberValidations, optionsValidations] = await Promise.all([
		validateNumberGradesInDb(db, numberGradeInputs),
		validateOptionsGradesInDb(db, optionsGradeInputs),
	]);

	const failedNumberValidation = numberValidations.find(
		(result): result is { valid: false; message: string } => !result.valid,
	);
	if (failedNumberValidation != null) {
		return { success: false, error: failedNumberValidation.message };
	}
	const failedOptionsValidation = optionsValidations.find(
		(result): result is { valid: false; message: string } => !result.valid,
	);
	if (failedOptionsValidation != null) {
		return { success: false, error: failedOptionsValidation.message };
	}

	const parentIdByPair = await upsertCriterionGradeParents(db, {
		gridRowId,
		resolved,
	});

	function resolveParentId(entry: ResolvedGradeWrite): number {
		const parentId = parentIdByPair.get(
			`${entry.gradeTargetRowId}:${entry.criterionRowId}`,
		);
		if (parentId == null) {
			throw new Error(
				"Expected a criterionGrade row to exist for every resolved grade after upsert.",
			);
		}
		return parentId;
	}

	const checkRows: CheckGradeWriteRow[] = [];
	const optionsRows: OptionsGradeWriteRow[] = [];
	const numberRows: NumberGradeWriteRow[] = [];
	const criterionGradeIdsByKind: Record<CriterionGrade["kind"], number[]> = {
		check: [],
		options: [],
		number: [],
	};

	// Each kind's writer persists that criterion kind's value; clearing the
	// other two kinds' subtype tables (below) keeps a criterion from carrying
	// stale values from a previous kind.
	for (const entry of resolved) {
		const criterionGradeId = resolveParentId(entry);
		criterionGradeIdsByKind[entry.grade.kind].push(criterionGradeId);

		switch (entry.grade.kind) {
			case "check":
				checkRows.push({
					criterionGradeId,
					grade: { passed: entry.grade.passed },
				});
				break;
			case "options":
				optionsRows.push({
					criterionGradeId,
					grade: { selectedLabel: entry.grade.selectedLabel },
				});
				break;
			case "number":
				numberRows.push({
					criterionGradeId,
					grade: { value: entry.grade.value },
				});
				break;
			default:
				assertNever(entry.grade);
		}
	}

	await Promise.all([
		writeCheckGradesInDb(db, checkRows),
		writeOptionsGradesInDb(db, optionsRows),
		writeNumberGradesInDb(db, numberRows),
		...clearStaleSubtypeValues(db, criterionGradeIdsByKind),
	]);

	return { success: true };
}

// Performs all validation + persistence for one Grade against the given db. No
// cache work. The db is a caller-supplied transaction; this write primitive
// cannot run on the global client. Adapts its one Grade into a one-item batch
// so the interactive save path and bulk callers share the same persistence
// mechanism (Grid/Grade Target/Rubric/Criterion resolution, kind dispatch,
// defensive validation, and stale-subtype cleanup all live in
// saveCriterionGradesInDb).
export async function saveCriterionGradeInDb(
	db: Transaction<Database>,
	{ gridId, targetId, rubricId, grade }: SaveCriterionGradeParams,
): Promise<SaveCriterionGradeResult> {
	return saveCriterionGradesInDb(db, {
		gridId,
		grades: [{ targetId, rubricId, grade }],
	});
}
