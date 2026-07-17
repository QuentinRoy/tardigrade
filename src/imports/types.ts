import type { z } from "zod";
import type { checkCriterionImportSchema } from "#criteria/check/checkSchemas.ts";
import type { numberCriterionImportSchema } from "#criteria/number/numberSchemas.ts";
import type { optionsCriterionImportSchema } from "#criteria/options/optionsSchemas.ts";
import type { GradeTargetKind } from "#grade-targets/types.ts";
import type {
	gradeRowSchema,
	rubricSchema,
	studentRowSchema,
} from "./schemas.ts";

export type ImportedCriterion =
	| z.output<typeof checkCriterionImportSchema>
	| z.output<typeof optionsCriterionImportSchema>
	| z.output<typeof numberCriterionImportSchema>;
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
