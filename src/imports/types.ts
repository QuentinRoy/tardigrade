import type { z } from "zod";
import type { SubmissionType } from "#submissions/types.ts";
import type {
	assessmentRowSchema,
	checkCriterionSchema,
	numberCriterionSchema,
	optionsCriterionSchema,
	rubricSchema,
	studentRowSchema,
} from "./schemas.ts";

export type ImportedCriterion =
	| z.output<typeof checkCriterionSchema>
	| z.output<typeof optionsCriterionSchema>
	| z.output<typeof numberCriterionSchema>;
export type ImportedRubric = z.output<typeof rubricSchema>;
export type ImportedRubrics = ImportedRubric[];
export type ImportedStudent = z.output<typeof studentRowSchema>;
export type ImportedAssessmentRow = z.output<typeof assessmentRowSchema>;
export type NormalizedImportedSubmission = {
	id: string;
	type: SubmissionType;
	team?: string;
	students: ImportedStudent[];
};
