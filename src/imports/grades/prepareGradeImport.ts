import type { CriterionGrade, CriterionKind } from "#criteria/types.ts";
import type { GradeTargetKind } from "#grade-targets/types.ts";
import type { ImportedGradeRow } from "#imports/types.ts";

// Column names match the snake_case headers produced by the grades export.
const KIND_COLUMN = "kind";
const NAME_COLUMN = "name";
const FINAL_TOTAL_COLUMN = "final_total";
const MARKS_COLUMN_SUFFIX = ":marks";
const TOTAL_COLUMN_SUFFIX = ":total";

export type GradeImportCriterion = {
	id: string;
	kind: CriterionKind;
	rubricId: string;
	ordinalLabels: string[];
};

export type GradeImportContext = {
	// Criterion value columns keyed `${rubricId}:${criterionId}`.
	criteriaByColumn: Map<string, GradeImportCriterion>;
	// Rubric ids of the grid; bare rubric total columns are derived export
	// output and are ignored on import.
	rubricIds: Set<string>;
	// Candidate grade target ids keyed by targetLookupKey().
	targetIdsByLookup: Map<string, string[]>;
	// (target, criterion) pairs that already hold a value, keyed by
	// gradedCriterionKey(). Used to report overwrites.
	gradedCriterionKeys: Set<string>;
};

export type GradeImportWrite = {
	targetId: string;
	rubricId: string;
	grade: CriterionGrade;
};

// `row` is the 1-based CSV line number; the header is line 1, data starts at 2.
export type GradeImportBlockingDiagnostic =
	| {
			type: "unmatched-target";
			row: number;
			targetKind: GradeTargetKind;
			name: string;
	  }
	| {
			type: "ambiguous-target";
			row: number;
			targetKind: GradeTargetKind;
			name: string;
	  }
	| {
			type: "invalid-value";
			row: number;
			name: string;
			column: string;
			message: string;
	  }
	| { type: "unknown-column"; column: string }
	| { type: "no-grade-columns" };

export type GradeImportOverwrite = { targetId: string; criterionId: string };

export type GradeImportPlan = {
	writes: GradeImportWrite[];
	blockingDiagnostics: GradeImportBlockingDiagnostic[];
	// Recognized derived export columns, reported but never imported.
	ignoredColumns: string[];
	// Writes that replace an existing value (last-write-wins policy).
	overwrites: GradeImportOverwrite[];
};

export function targetLookupKey(params: {
	targetKind: GradeTargetKind;
	name: string;
}): string {
	return `${params.targetKind}:${params.name}`;
}

export function gradedCriterionKey(params: {
	targetId: string;
	criterionId: string;
}): string {
	return `${params.targetId}:${params.criterionId}`;
}

function parseGradeValue(params: {
	value: string;
	criterion: GradeImportCriterion;
}): CriterionGrade {
	const { value, criterion } = params;

	switch (criterion.kind) {
		case "check": {
			const normalizedValue = value.toLowerCase();
			if (normalizedValue !== "true" && normalizedValue !== "false") {
				throw new Error(`Invalid check value "${value}"`);
			}

			return {
				criterionId: criterion.id,
				kind: "check",
				passed: normalizedValue === "true",
			};
		}
		case "options": {
			if (criterion.ordinalLabels.length > 0) {
				const labelExists = criterion.ordinalLabels.includes(value);
				if (!labelExists) {
					throw new Error(
						`Invalid ordinal value "${value}" for criterion ${criterion.id}`,
					);
				}
			}

			return {
				criterionId: criterion.id,
				kind: "options",
				selectedLabel: value,
			};
		}
		case "number": {
			const criterionValue = parseFloat(value);
			if (Number.isNaN(criterionValue)) {
				throw new Error(`Invalid numerical value "${value}"`);
			}

			return {
				criterionId: criterion.id,
				kind: "number",
				value: criterionValue,
			};
		}
	}
}

export function prepareGradeImport(params: {
	rows: ImportedGradeRow[];
	context: GradeImportContext;
}): GradeImportPlan {
	const { rows, context } = params;
	const writes: GradeImportWrite[] = [];
	const blockingDiagnostics: GradeImportBlockingDiagnostic[] = [];
	const ignoredColumns: string[] = [];
	const overwrites: GradeImportOverwrite[] = [];

	const headerColumns = Object.keys(rows.at(0) ?? {});
	for (const column of headerColumns) {
		if (
			column === KIND_COLUMN ||
			column === NAME_COLUMN ||
			context.criteriaByColumn.has(column)
		) {
			continue;
		}

		const isDerivedMarksColumn =
			column.endsWith(MARKS_COLUMN_SUFFIX) &&
			context.criteriaByColumn.has(
				column.slice(0, -MARKS_COLUMN_SUFFIX.length),
			);
		const isDerivedTotalColumn =
			column.endsWith(TOTAL_COLUMN_SUFFIX) &&
			context.rubricIds.has(column.slice(0, -TOTAL_COLUMN_SUFFIX.length));
		if (
			column === FINAL_TOTAL_COLUMN ||
			isDerivedTotalColumn ||
			isDerivedMarksColumn
		) {
			ignoredColumns.push(column);
			continue;
		}

		blockingDiagnostics.push({ type: "unknown-column", column });
	}

	if (!headerColumns.some((column) => context.criteriaByColumn.has(column))) {
		blockingDiagnostics.push({ type: "no-grade-columns" });
	}

	for (const [rowIndex, row] of rows.entries()) {
		const csvLine = rowIndex + 2;
		const targetIds =
			context.targetIdsByLookup.get(
				targetLookupKey({ targetKind: row.kind, name: row.name }),
			) ?? [];
		const targetId = targetIds[0];

		if (targetId == null) {
			blockingDiagnostics.push({
				type: "unmatched-target",
				row: csvLine,
				targetKind: row.kind,
				name: row.name,
			});
			continue;
		}

		if (targetIds.length > 1) {
			blockingDiagnostics.push({
				type: "ambiguous-target",
				row: csvLine,
				targetKind: row.kind,
				name: row.name,
			});
			continue;
		}

		for (const [column, criterion] of context.criteriaByColumn) {
			const value = row[column]?.trim();

			if (!value) {
				continue;
			}

			let grade: CriterionGrade;
			try {
				grade = parseGradeValue({ value, criterion });
			} catch (error) {
				blockingDiagnostics.push({
					type: "invalid-value",
					row: csvLine,
					name: row.name,
					column,
					message: error instanceof Error ? error.message : String(error),
				});
				continue;
			}

			writes.push({ targetId, rubricId: criterion.rubricId, grade });

			if (
				context.gradedCriterionKeys.has(
					gradedCriterionKey({ targetId, criterionId: criterion.id }),
				)
			) {
				overwrites.push({ targetId, criterionId: criterion.id });
			}
		}
	}

	return { writes, blockingDiagnostics, ignoredColumns, overwrites };
}
