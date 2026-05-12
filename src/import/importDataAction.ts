"use server";

import { revalidateTag } from "next/cache";
import { prettifyError, ZodError } from "zod";
import {
  buildSubmissionsFromStudents,
  parseQuestionsYaml,
  parseStudentsCsv,
  persistImportData,
} from "./importData";
import type { ImportState } from "./importState";

export type { ImportState } from "./importState";

export async function importDataAction(
  _previousState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const questionsYaml = String(formData.get("questionsYaml") ?? "");
  const studentsCsv = String(formData.get("studentsCsv") ?? "");

  try {
    const questions = parseQuestionsYaml(questionsYaml);
    const students = parseStudentsCsv(studentsCsv);
    const submissions = buildSubmissionsFromStudents(students);

    const result = await persistImportData(questions, submissions);

    revalidateTag("questions", "seconds");
    revalidateTag("submissions", "seconds");
    revalidateTag("assessments", "seconds");

    return {
      status: "success",
      message: `Imported ${result.questionCount} questions, ${result.rubricCount} rubrics, ${result.submissionCount} submissions, and ${result.studentCount} students. Existing records were updated in place.`,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        errors: [prettifyError(error)],
      };
    }

    if (error instanceof Error) {
      return {
        status: "error",
        errors: [error.message],
      };
    }

    return {
      status: "error",
      errors: ["Unknown import error"],
    };
  }
}
