import type { z } from "zod";
import type { SubmissionType } from "#submissions/types.ts";
import type {
	assessmentRowSchema,
	checkCriterionSchema,
	numberCriterionSchema,
	optionsCriterionSchema,
	questionSchema,
	studentRowSchema,
} from "./schemas.ts";

export type ImportedCriterion =
	| z.output<typeof checkCriterionSchema>
	| z.output<typeof optionsCriterionSchema>
	| z.output<typeof numberCriterionSchema>;
export type ImportedQuestion = z.output<typeof questionSchema>;
export type ImportedQuestions = ImportedQuestion[];
export type ImportedStudent = z.output<typeof studentRowSchema>;
export type ImportedAssessmentRow = z.output<typeof assessmentRowSchema>;
export type NormalizedImportedSubmission = {
	id: string;
	type: SubmissionType;
	team?: string;
	students: ImportedStudent[];
};
