import { z } from "zod";

const idSchema = z.string().trim().min(1, "Id is required");
const previousIdSchema = idSchema.optional();

const checkCriterionDefinitionSchema = z.object({
	previousId: previousIdSchema,
	id: idSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	kind: z.literal("check"),
	marks: z.number({ error: "Marks must be a valid number" }),
	falseMarks: z.number({ error: "No marks must be a valid number" }).optional(),
});

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

const numberCriterionDefinitionSchema = z.object({
	previousId: previousIdSchema,
	id: idSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	kind: z.literal("number"),
	minValue: z.number({ error: "Min value must be a valid number" }),
	maxValue: z.number({ error: "Max value must be a valid number" }),
	minMarks: z.number({ error: "Min marks must be a valid number" }),
	maxMarks: z.number({ error: "Max marks must be a valid number" }),
	reversed: z.boolean(),
});

const criterionDefinitionSchema = z.discriminatedUnion("kind", [
	checkCriterionDefinitionSchema,
	optionsCriterionDefinitionSchema,
	numberCriterionDefinitionSchema,
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

		rubric.criteria.forEach((criterion, index) => {
			if (criterion.kind !== "number") {
				return;
			}

			if (criterion.minValue >= criterion.maxValue) {
				ctx.addIssue({
					code: "custom",
					message: "Max value must be greater than min value",
					path: ["criteria", index, "maxValue"],
				});
			}

			if (criterion.minMarks > criterion.maxMarks) {
				ctx.addIssue({
					code: "custom",
					message: "Max marks must be greater than or equal to min marks",
					path: ["criteria", index, "maxMarks"],
				});
			}
		});
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
