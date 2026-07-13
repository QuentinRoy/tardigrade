"use server";

import { toImportErrorState } from "#imports/actionUtils.ts";
import type { ActionState } from "#utils/actionState.ts";
import { parseGradesCsv } from "./parseGrades.ts";
import { saveGrades } from "./saveGrades.ts";

export async function gradesImportAction(
	projectId: string,
	_previousState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const gradesCsv = String(formData.get("gradesCsv") ?? "");

	try {
		const grades = await parseGradesCsv(gradesCsv);
		const result = await saveGrades({ rows: grades, projectId });

		const overwriteSuffix =
			result.overwriteCount > 0
				? ` (${result.overwriteCount} overwritten)`
				: "";

		return {
			status: "success",
			message: `Imported ${result.gradeCount} grades${overwriteSuffix}.`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
