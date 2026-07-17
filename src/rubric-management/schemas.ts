import { z } from "zod";
import { checkCriterionEditorSchema } from "#criteria/check/checkSchemas.ts";
import {
	editorIdSchema as idSchema,
	editorPreviousIdSchema as previousIdSchema,
} from "#criteria/criterionSchemaAtoms.ts";
import { numberCriterionEditorSchema } from "#criteria/number/numberSchemas.ts";

const optionsCriterionDefinitionSchema = z.object({
	previousId: previousIdSchema,
	id: idSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	kind: z.literal("options"),
	marks: z
		.record(z.string(), z.number())
		.refine((marks) => Object.keys(marks).length >= 2, {
			message: "Options criterion must have at least 2 mark entries",
		}),
});

const criterionDefinitionSchema = z.discriminatedUnion("kind", [
	checkCriterionEditorSchema,
	optionsCriterionDefinitionSchema,
	numberCriterionEditorSchema,
]);

export const rubricDefinitionSchema = z
	.object({
		originalId: idSchema.optional(),
		id: idSchema,
		label: z.string().trim().optional(),
		criteria: z.array(criterionDefinitionSchema),
	})
	.superRefine((rubric, ctx) => {
		const criterionIds = new Map<string, number[]>();
		const sourceIds = new Map<string, number[]>();

		rubric.criteria.forEach((criterion, index) => {
			const criterionId = criterion.id.trim();
			const sourceId = criterion.previousId?.trim() || criterionId;

			if (criterionId.length > 0) {
				const indexes = criterionIds.get(criterionId) ?? [];
				indexes.push(index);
				criterionIds.set(criterionId, indexes);
			}

			if (sourceId.length > 0) {
				const indexes = sourceIds.get(sourceId) ?? [];
				indexes.push(index);
				sourceIds.set(sourceId, indexes);
			}
		});

		for (const indexes of criterionIds.values()) {
			if (indexes.length > 1) {
				for (const index of indexes) {
					ctx.addIssue({
						code: "custom",
						message: "Criterion ids must be unique.",
						path: ["criteria", index, "id"],
					});
				}
			}
		}

		for (const indexes of sourceIds.values()) {
			if (indexes.length > 1) {
				for (const index of indexes) {
					ctx.addIssue({
						code: "custom",
						message: "Criterion source ids must be unique.",
						path: ["criteria", index, "id"],
					});
				}
			}
		}
	});

export const deleteRubricSchema = z.object({
	rubricId: idSchema,
	confirmationText: z.string(),
	expectedPhrase: z.string(),
});

export type RubricDefinitionPayload = z.output<typeof rubricDefinitionSchema>;

export function parseRubricDefinitionPayload(
	raw: string,
): RubricDefinitionPayload {
	const parsed: unknown = JSON.parse(raw);
	return rubricDefinitionSchema.parse(parsed);
}

export function parseDeletePayload(
	raw: string,
): z.output<typeof deleteRubricSchema> {
	const parsed: unknown = JSON.parse(raw);
	return deleteRubricSchema.parse(parsed);
}

export function matchesDeleteConfirmation(
	confirmationText: string,
	expectedPhrase: string,
): boolean {
	return (
		confirmationText.trim().toLocaleLowerCase() ===
		expectedPhrase.trim().toLocaleLowerCase()
	);
}
