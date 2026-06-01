import { z } from "zod";

const idSchema = z.string().trim().min(1, "Id is required");
const previousIdSchema = idSchema.optional();

const booleanRubricDefinitionSchema = z.object({
	previousId: previousIdSchema,
	id: idSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	type: z.literal("boolean"),
	marks: z.number(),
	falseMarks: z.number().optional(),
});

const ordinalRubricDefinitionSchema = z.object({
	previousId: previousIdSchema,
	id: idSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	type: z.literal("ordinal"),
	marks: z.record(z.string(), z.number()),
});

const numericalRubricDefinitionSchema = z.object({
	previousId: previousIdSchema,
	id: idSchema,
	description: z.string().trim().optional(),
	label: z.string().trim().optional(),
	type: z.literal("numerical"),
	minScore: z.number(),
	maxScore: z.number(),
	minMarks: z.number(),
	maxMarks: z.number(),
	reversed: z.boolean(),
});

const rubricDefinitionSchema = z.discriminatedUnion("type", [
	booleanRubricDefinitionSchema,
	ordinalRubricDefinitionSchema,
	numericalRubricDefinitionSchema,
]);

export const questionDefinitionSchema = z
	.object({
		originalId: idSchema.optional(),
		id: idSchema,
		label: z.string().trim().optional(),
		rubrics: z.array(rubricDefinitionSchema),
	})
	.superRefine((question, ctx) => {
		const rubricIds = new Map<string, number[]>();
		const sourceIds = new Map<string, number[]>();

		question.rubrics.forEach((rubric, index) => {
			const rubricId = rubric.id.trim();
			const sourceId = rubric.previousId?.trim() || rubricId;

			if (rubricId.length > 0) {
				const indexes = rubricIds.get(rubricId) ?? [];
				indexes.push(index);
				rubricIds.set(rubricId, indexes);
			}

			if (sourceId.length > 0) {
				const indexes = sourceIds.get(sourceId) ?? [];
				indexes.push(index);
				sourceIds.set(sourceId, indexes);
			}
		});

		for (const indexes of rubricIds.values()) {
			if (indexes.length > 1) {
				for (const index of indexes) {
					ctx.addIssue({
						code: "custom",
						message: "Rubric ids must be unique.",
						path: ["rubrics", index, "id"],
					});
				}
			}
		}

		for (const indexes of sourceIds.values()) {
			if (indexes.length > 1) {
				for (const index of indexes) {
					ctx.addIssue({
						code: "custom",
						message: "Rubric source ids must be unique.",
						path: ["rubrics", index, "id"],
					});
				}
			}
		}
	});

export const deleteQuestionSchema = z.object({
	questionId: idSchema,
	confirmationText: z.string(),
	expectedPhrase: z.string(),
});

export type QuestionDefinitionPayload = z.output<
	typeof questionDefinitionSchema
>;

export function parseQuestionDefinitionPayload(
	raw: string,
): QuestionDefinitionPayload {
	const parsed = JSON.parse(raw) as unknown;
	return questionDefinitionSchema.parse(parsed);
}

export function parseDeletePayload(
	raw: string,
): z.output<typeof deleteQuestionSchema> {
	const parsed = JSON.parse(raw) as unknown;
	return deleteQuestionSchema.parse(parsed);
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
