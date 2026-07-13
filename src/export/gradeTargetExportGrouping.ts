import type { CriterionGrade } from "#criteria/types.ts";
import { buildGradeKey } from "./gradeTargetExportCsv.ts";

export type GradeTargetExportRow = {
	gradeTargetRowId: number | null;
	gradeTargetId: string | null;
	gradeTargetKind: "group" | "individual" | null;
	groupName: string | null;
	studentId: string | null;
	rubricId: string | null;
	criterionId: string | null;
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

function toNumber(value: string | number): number {
	if (typeof value === "number") return value;
	return parseFloat(value);
}

export async function* groupGradeTargetRows(
	rows: AsyncIterable<GradeTargetExportRow>,
): AsyncGenerator<GroupedGradeTargetRow> {
	// Rows are grouped and ordered by the internal `rowId` (creation order —
	// the public `id` is a per-project text ordinal and does not sort
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

		if (row.rubricId == null || row.criterionId == null) continue;

		const key = buildGradeKey(row.rubricId, row.criterionId);

		if (row.checkPassed != null) {
			currentValuesByKey.set(key, {
				criterionId: row.criterionId,
				kind: "check",
				passed: row.checkPassed,
			});
			continue;
		}

		if (row.optionsSelectedLabel != null) {
			currentValuesByKey.set(key, {
				criterionId: row.criterionId,
				kind: "options",
				selectedLabel: row.optionsSelectedLabel,
			});
			continue;
		}

		if (row.numberValue != null) {
			currentValuesByKey.set(key, {
				criterionId: row.criterionId,
				kind: "number",
				score: toNumber(row.numberValue),
			});
		}
	}

	if (currentGradeTargetRowId != null) {
		yield flush();
	}
}
