import { toCriterionGrade } from "#criteria/criterionGradeHydration.ts";
import type { CriterionGrade, CriterionKind } from "#criteria/types.ts";
import { buildGradeKey } from "./gradeTargetExportCsv.ts";

export type GradeTargetExportRow = {
	gradeTargetRowId: number | null;
	gradeTargetId: string | null;
	rubricId: string | null;
	criterionId: string | null;
	kind: CriterionKind | null;
	checkPassed: boolean | null;
	optionsSelectedLabel: string | null;
	numberValue: string | number | null;
};

export type GroupedGradeTargetRow = {
	gradeTargetId: string;
	valuesByKey: Map<string, CriterionGrade>;
};

export async function* groupGradeTargetRows(
	rows: AsyncIterable<GradeTargetExportRow>,
): AsyncGenerator<GroupedGradeTargetRow> {
	// Rows are grouped and ordered by the internal `rowId` (creation order —
	// the public `id` is a per-grid text ordinal and does not sort
	// correctly, see the loader's ordering note); the public id is carried
	// alongside purely to name the target in the output, never for ordering.
	let currentGradeTargetRowId: number | null = null;
	let currentGradeTargetId: string | null = null;
	let currentValuesByKey = new Map<string, CriterionGrade>();

	function flush(): GroupedGradeTargetRow {
		if (currentGradeTargetId == null) {
			throw new Error("Missing grade target data while grouping.");
		}
		return {
			gradeTargetId: currentGradeTargetId,
			valuesByKey: currentValuesByKey,
		};
	}

	for await (const row of rows) {
		if (row.gradeTargetRowId == null) continue;

		if (
			currentGradeTargetRowId != null &&
			row.gradeTargetRowId !== currentGradeTargetRowId
		) {
			yield flush();
			currentValuesByKey = new Map();
		}

		currentGradeTargetRowId = row.gradeTargetRowId;
		currentGradeTargetId = row.gradeTargetId;

		// A row with no linked criterion carries no grade (e.g. a grade target
		// with no grades yet) and is skipped.
		if (row.rubricId == null || row.criterionId == null) continue;

		// A linked criterion always has a kind: `criterion.kind` is `NOT NULL`
		// and `criterionGrade.criterionRowId` is a `NOT NULL` FK, so the criterion
		// join matches whenever a grade exists. A null `kind` here means that
		// invariant broke — fail loudly rather than silently dropping the grade.
		if (row.kind == null) {
			throw new Error(
				`Grade export row for criterion ${row.criterionId} has a grade but no criterion kind.`,
			);
		}

		// A grade is hydrated under its criterion's kind. `clearOtherSubtypeValues`
		// keeps only the matching subtype column populated, and a kind change deletes
		// the criterion (cascading its grades away), so exactly one column is non-null
		// for the current kind — dispatching on `kind` matches the stored value.
		const grade = toCriterionGrade({
			criterionId: row.criterionId,
			kind: row.kind,
			passed: row.checkPassed,
			selectedLabel: row.optionsSelectedLabel,
			value: row.numberValue,
		});
		if (grade != null) {
			currentValuesByKey.set(
				buildGradeKey(row.rubricId, row.criterionId),
				grade,
			);
		}
	}

	if (currentGradeTargetRowId != null) {
		yield flush();
	}
}
