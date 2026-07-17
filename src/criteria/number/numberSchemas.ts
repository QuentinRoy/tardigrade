import { z } from "zod";
import {
	baseImportCriterionSchema,
	editorIdSchema,
	editorPreviousIdSchema,
	importNumericValue,
} from "#criteria/criterionSchemaAtoms.ts";
import {
	isNumberMarksRangeValid,
	isNumberValueRangeValid,
} from "./numberBounds.ts";

// Editor-boundary schema leaf for a Number criterion. `z.output` is the canonical
// editor/command value for Number (ADR 0013: collapse the hand-written
// editor/command unions to the schema output). The bounds `superRefine` lives on
// the leaf with relative issue paths, so the composed `criteria[i].maxValue`/
// `criteria[i].maxMarks` paths are unchanged from when it lived in the
// rubric-level `superRefine`.
export const numberCriterionEditorSchema = z
	.object({
		previousId: editorPreviousIdSchema,
		id: editorIdSchema,
		description: z.string().trim().optional(),
		label: z.string().trim().optional(),
		kind: z.literal("number"),
		minValue: z.number({ error: "Min value must be a valid number" }),
		maxValue: z.number({ error: "Max value must be a valid number" }),
		minMarks: z.number({ error: "Min marks must be a valid number" }),
		maxMarks: z.number({ error: "Max marks must be a valid number" }),
		reversed: z.boolean(),
	})
	.superRefine((criterion, ctx) => {
		if (!isNumberValueRangeValid(criterion)) {
			ctx.addIssue({
				code: "custom",
				message: "Max value must be greater than min value",
				path: ["maxValue"],
			});
		}

		if (!isNumberMarksRangeValid(criterion)) {
			ctx.addIssue({
				code: "custom",
				message: "Max marks must be greater than or equal to min marks",
				path: ["maxMarks"],
			});
		}
	});

export type NumberCriterionDefinitionInput = z.output<
	typeof numberCriterionEditorSchema
>;

// Import (YAML decode) boundary schema leaf for a Number criterion. A
// deliberately distinct accepted value from the editor schema: optional fields
// with defaults applied by `.transform()`, strict unknown-key rejection, and no
// `previousId`. The final two refines consume the shared bounds invariant so the
// rule matches every other boundary while the message stays boundary-specific.
export const numberCriterionImportSchema = baseImportCriterionSchema
	.extend({
		kind: z.literal("number"),
		minValue: importNumericValue.optional(),
		maxValue: importNumericValue.optional(),
		minMarks: importNumericValue.optional(),
		maxMarks: importNumericValue.optional(),
		reversed: z.boolean().optional(),
	})
	.strict()
	.refine((r) => r.minMarks != null || r.maxMarks != null, {
		message:
			"Number criterion must provide at least one of minMarks or maxMarks",
	})
	.refine((r) => r.minValue == null || r.maxValue != null, {
		message: "maxValue must be provided when minValue is provided",
	})
	.refine((r) => r.minMarks != null || (r.maxMarks ?? 0) > 0, {
		message: "When minMarks is omitted, maxMarks must be greater than 0",
	})
	.refine((r) => r.maxMarks != null || (r.minMarks ?? 0) < 0, {
		message: "When maxMarks is omitted, minMarks must be less than 0",
	})
	.transform((r) => ({
		...r,
		minValue: r.minValue ?? 0,
		maxValue: r.maxValue ?? 1,
		minMarks: r.minMarks ?? 0,
		maxMarks: r.maxMarks ?? 0,
		reversed: r.reversed ?? false,
	}))
	.refine((r) => isNumberMarksRangeValid(r), {
		message: "minMarks must be less than or equal to maxMarks",
	})
	.refine((r) => isNumberValueRangeValid(r), {
		message: "minValue must be less than maxValue",
	});
