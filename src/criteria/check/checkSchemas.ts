import { z } from "zod";
import {
	baseImportCriterionSchema,
	editorIdSchema,
	editorPreviousIdSchema,
	importNumericValue,
} from "#criteria/criterionSchemaAtoms.ts";

// Editor-boundary schema leaf for a Check criterion. `z.output` is the canonical
// editor/command value for Check (ADR 0013: collapse the hand-written
// editor/command unions to the schema output).
export const checkCriterionEditorSchema = z.object({
	previousId: editorPreviousIdSchema,
	id: editorIdSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	kind: z.literal("check"),
	marks: z.number({ error: "Marks must be a valid number" }),
	falseMarks: z
		.number({ error: "Enter a valid number for No marks." })
		.optional(),
});

export type CheckCriterionEditorValue = z.output<
	typeof checkCriterionEditorSchema
>;

// Import (YAML decode) boundary schema leaf for a Check criterion. A deliberately
// distinct accepted value from the editor schema (strict unknown-key rejection,
// no `previousId`).
export const checkCriterionImportSchema = baseImportCriterionSchema
	.extend({
		kind: z.literal("check"),
		marks: importNumericValue,
		falseMarks: importNumericValue.optional(),
	})
	.strict();

// Default value the authoring UI seeds a new Check criterion with.
export function createCheckCriterion(): CheckCriterionEditorValue {
	return {
		id: "",
		kind: "check",
		label: "",
		description: "",
		marks: 1,
		falseMarks: 0,
	};
}
