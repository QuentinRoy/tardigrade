import { z } from "zod";
import type { SubmissionType } from "@/db/types";
import {
  booleanRubricSchema,
  numericalRubricSchema,
  ordinalRubricSchema,
  questionSchema,
  studentRowSchema,
} from "./schemas";

export type ImportedRubric =
  | z.output<typeof booleanRubricSchema>
  | z.output<typeof ordinalRubricSchema>
  | z.output<typeof numericalRubricSchema>;
export type ImportedQuestion = z.output<typeof questionSchema>;
export type ImportedQuestions = ImportedQuestion[];
export type ImportedStudent = z.output<typeof studentRowSchema>;
export type ImportedAssessmentRow = Record<string, string>;
export type ImportedSubmission = {
  id: string;
  type: SubmissionType;
  team?: string;
  students: ImportedStudent[];
};
