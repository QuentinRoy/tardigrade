import { z } from "zod";
import {
	baseImportCriterionSchema,
	editorIdSchema,
	editorPreviousIdSchema,
	importNonEmptyString,
	importNumericValue,
} from "#criteria/criterionSchemaAtoms.ts";
import { hasEnoughOptionsMarks } from "./optionsMarks.ts";

// Both write boundaries happen to word the Options Marks Minimum identically
// today. Naming the sentence keeps the two leaves below from drifting apart by
// accident; each leaf still owns its own message, as Number's do.
const optionsMarksMinimumMessage =
	"Options criterion must have at least 2 mark entries";

// Editor-boundary schema leaf for an Options criterion. `z.output` is the
// canonical editor/command value for Options (ADR 0013: collapse the
// hand-written editor/command unions to the schema output). The marks-minimum
// refine sits on the `marks` field, so the composed `criteria[i].marks` issue
// path is unchanged from when this schema lived in `rubric-management`.
export const optionsCriterionEditorSchema = z.object({
	previousId: editorPreviousIdSchema,
	id: editorIdSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	kind: z.literal("options"),
	marks: z
		.record(z.string(), z.number())
		.refine(hasEnoughOptionsMarks, { message: optionsMarksMinimumMessage }),
});

export type OptionsCriterionDefinitionInput = z.output<
	typeof optionsCriterionEditorSchema
>;

// Import (YAML decode) boundary schema leaf for an Options criterion. A
// deliberately distinct accepted value from the editor schema: non-empty mark
// labels, strict unknown-key rejection, and no `previousId`. Its marks-minimum
// refine consumes the same shared invariant, so the rule matches the editor
// while the boundary keeps its own accepted shape.
export const optionsCriterionImportSchema = baseImportCriterionSchema
	.extend({
		kind: z.literal("options"),
		marks: z
			.record(importNonEmptyString, importNumericValue)
			.refine(hasEnoughOptionsMarks, { message: optionsMarksMinimumMessage }),
	})
	.strict();
