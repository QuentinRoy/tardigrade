"use server";

import { toImportErrorState } from "./actionUtils.ts";
import type { ImportState } from "./importState.ts";
import { parseAssessmentsCsv } from "./parseAssessments.ts";
import { saveAssessments } from "./saveAssessments.ts";

export async function assessmentsImportAction(
	projectId: string,
	_previousState: ImportState,
	formData: FormData,
): Promise<ImportState> {
	const assessmentsCsv = String(formData.get("assessmentsCsv") ?? "");

	try {
		const assessments = await parseAssessmentsCsv(assessmentsCsv);
		const result = await saveAssessments({ rows: assessments, projectId });

		return {
			status: "success",
			message: `Imported ${result.assessmentCount} assessments.`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
