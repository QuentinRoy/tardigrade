"use server";

import { revalidateTag } from "next/cache";
import { toImportErrorState } from "./actionUtils";
import type { ImportState } from "./importState";
import {
	groupStudentsIntoSubmissions,
	parseStudentsCsv,
} from "./parseStudents";
import { saveStudents } from "./saveStudents";

export async function studentsImportAction(
	projectId: string,
	_previousState: ImportState,
	formData: FormData,
): Promise<ImportState> {
	const studentsCsv = String(formData.get("studentsCsv") ?? "");

	try {
		const students = parseStudentsCsv(studentsCsv);
		const submissions = groupStudentsIntoSubmissions(students);
		const result = await saveStudents(submissions, projectId);

		revalidateTag("submissions", "max");
		revalidateTag("assessments", "max");
		revalidateTag("assessments:all", "max");

		return {
			status: "success",
			message: `Imported ${result.submissionCount} submissions and ${result.studentCount} students. Existing records were updated in place.`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
