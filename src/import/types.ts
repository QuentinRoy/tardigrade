import type { z } from "zod";
import type { SubmissionType } from "#submissions/types.ts";
import type {
	assessmentRowSchema,
	booleanRubricSchema,
	numericalRubricSchema,
	ordinalRubricSchema,
	questionSchema,
	studentRowSchema,
} from "./schemas.ts";

export type ImportedRubric =
	| z.output<typeof booleanRubricSchema>
	| z.output<typeof ordinalRubricSchema>
	| z.output<typeof numericalRubricSchema>;
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
