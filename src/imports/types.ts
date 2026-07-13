import type { z } from "zod";
import type { GradeTargetKind } from "#grade-targets/types.ts";
import type {
	checkCriterionSchema,
	gradeRowSchema,
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
export type ImportedGradeRow = z.output<typeof gradeRowSchema>;
export type NormalizedImportedGradeTarget = {
	id: string;
	kind: GradeTargetKind;
	group?: string;
	students: ImportedStudent[];
};
