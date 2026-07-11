"use server";

import { toImportErrorState } from "#imports/actionUtils.ts";
import type { ActionState } from "#utils/actionState.ts";
import {
	groupStudentsIntoGradeTargets,
	parseStudentsCsv,
} from "./parseStudents.ts";
import { saveStudents } from "./saveStudents.ts";

export async function studentsImportAction(
	projectId: string,
	_previousState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const studentsCsv = String(formData.get("studentsCsv") ?? "");

	try {
		const students = parseStudentsCsv(studentsCsv);
		const targets = groupStudentsIntoGradeTargets(students);
		const result = await saveStudents({ targets, projectId });

		return {
			status: "success",
			message: `Imported ${result.createdGradeTargetCount} new and updated ${result.updatedGradeTargetCount} existing students and groups; imported ${result.createdStudentCount} new and updated ${result.updatedStudentCount} existing students.`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
