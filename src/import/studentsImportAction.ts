"use server";

import { toImportErrorState } from "./actionUtils.ts";
import type { ImportState } from "./importState.ts";
import {
	groupStudentsIntoSubmissions,
	parseStudentsCsv,
} from "./parseStudents.ts";
import { saveStudents } from "./saveStudents.ts";

export async function studentsImportAction(
	projectId: string,
	_previousState: ImportState,
	formData: FormData,
): Promise<ImportState> {
	const studentsCsv = String(formData.get("studentsCsv") ?? "");

	try {
		const students = parseStudentsCsv(studentsCsv);
		const submissions = groupStudentsIntoSubmissions(students);
		const result = await saveStudents({ submissions, projectId });

		return {
			status: "success",
			message: `Imported ${result.submissionCount} submissions and ${result.studentCount} students. Existing records were updated in place.`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
