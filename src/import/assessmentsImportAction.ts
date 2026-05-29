"use server";

import { revalidateTag } from "next/cache";
import { toImportErrorState } from "./actionUtils";
import type { ImportState } from "./importState";
import { parseAssessmentsCsv } from "./parseAssessments";
import { saveAssessments } from "./saveAssessments";

export async function assessmentsImportAction(
	projectId: string,
	_previousState: ImportState,
	formData: FormData,
): Promise<ImportState> {
	const assessmentsCsv = String(formData.get("assessmentsCsv") ?? "");

	try {
		const assessments = await parseAssessmentsCsv(assessmentsCsv);
		const result = await saveAssessments(assessments, projectId);

		revalidateTag("assessments", "max");
		revalidateTag("assessments:all", "max");

		return {
			status: "success",
			message: `Imported ${result.assessmentCount} assessments.`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
