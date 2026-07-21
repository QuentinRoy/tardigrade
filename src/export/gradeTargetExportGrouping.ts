import { toCriterionGrade } from "#criteria/criterionGradeHydration.ts";
import type { CriterionGrade, CriterionKind } from "#criteria/types.ts";
import { buildGradeKey } from "./gradeTargetExportCsv.ts";

export type GradeTargetExportRow = {
	gradeTargetRowId: number | null;
	gradeTargetId: string | null;
	gradeTargetKind: "group" | "individual" | null;
	groupName: string | null;
	studentId: string | null;
	rubricId: string | null;
	criterionId: string | null;
	kind: CriterionKind | null;
	checkPassed: boolean | null;
	optionsSelectedLabel: string | null;
	numberValue: string | number | null;
};

export type GroupedGradeTargetRow = {
	gradeTargetId: string;
	gradeTargetKind: "group" | "individual";
	groupName: string | null;
	studentId: string | null;
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
	let currentGradeTargetKind: "group" | "individual" | null = null;
	let currentGroupName: string | null = null;
	let currentStudentId: string | null = null;
	let currentValuesByKey = new Map<string, CriterionGrade>();

	function flush(): GroupedGradeTargetRow {
		if (currentGradeTargetId == null || currentGradeTargetKind == null) {
			throw new Error("Missing grade target data while grouping.");
		}
		return {
			gradeTargetId: currentGradeTargetId,
			gradeTargetKind: currentGradeTargetKind,
			groupName: currentGroupName,
			studentId: currentStudentId,
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
		currentGradeTargetKind = row.gradeTargetKind;
		currentGroupName = row.groupName;
		currentStudentId = row.studentId;

		if (row.rubricId == null || row.criterionId == null || row.kind == null) {
			continue;
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
