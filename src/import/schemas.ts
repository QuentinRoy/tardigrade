import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const numericValue = z.number();

const baseRubricSchema = z.object({
	id: nonEmptyString,
	description: nonEmptyString.optional(),
	label: nonEmptyString.optional(),
	type: z.string(),
});

export const booleanRubricSchema = baseRubricSchema.extend({
	type: z.literal("boolean"),
	marks: numericValue,
	falseMarks: numericValue.optional(),
});

const ordinalMarksSchema = z
	.record(nonEmptyString, numericValue)
	.refine((marks) => Object.keys(marks).length >= 2, {
		message: "Ordinal rubric must have at least 2 mark entries",
	});

export const ordinalRubricSchema = baseRubricSchema.extend({
	type: z.literal("ordinal"),
	marks: ordinalMarksSchema,
});

export const numericalRubricSchema = baseRubricSchema
	.extend({
		type: z.literal("numerical"),
		minScore: numericValue.optional(),
		maxScore: numericValue.optional(),
		minMarks: numericValue.optional(),
		maxMarks: numericValue.optional(),
		reversed: z.boolean().optional(),
	})
	.refine((r) => r.minMarks != null || r.maxMarks != null, {
		message:
			"Numerical rubric must provide at least one of minMarks or maxMarks",
	})
	.refine((r) => r.minScore == null || r.maxScore != null, {
		message: "maxScore must be provided when minScore is provided",
	})
	.refine((r) => r.minMarks != null || (r.maxMarks ?? 0) > 0, {
		message: "When minMarks is omitted, maxMarks must be greater than 0",
	})
	.refine((r) => r.maxMarks != null || (r.minMarks ?? 0) < 0, {
		message: "When maxMarks is omitted, minMarks must be less than 0",
	})
	.transform((r) => ({
		...r,
		minScore: r.minScore ?? 0,
		maxScore: r.maxScore ?? 1,
		minMarks: r.minMarks ?? 0,
		maxMarks: r.maxMarks ?? 0,
		reversed: r.reversed ?? false,
	}))
	.refine((r) => r.minMarks <= r.maxMarks, {
		message: "minMarks must be less than or equal to maxMarks",
	})
	.refine((r) => r.minScore < r.maxScore, {
		message: "minScore must be less than maxScore",
	});

const rubricSchema = z.discriminatedUnion("type", [
	booleanRubricSchema,
	ordinalRubricSchema,
	numericalRubricSchema,
]);

export const questionSchema = z.object({
	id: nonEmptyString,
	label: nonEmptyString.optional(),
	rubrics: z
		.array(rubricSchema)
		.refine(
			(rubrics) => new Set(rubrics.map((r) => r.id)).size === rubrics.length,
			{ message: "Rubric ids must be unique within a question" },
		),
});

const questionsSchema = z.object({
	questions: z
		.array(questionSchema)
		.refine(
			(questions) =>
				new Set(questions.map((q) => q.id)).size === questions.length,
			{ message: "Question ids must be unique" },
		),
});

export const studentRowSchema = z
	.object({
		last_name: nonEmptyString,
		first_name: nonEmptyString,
		id: nonEmptyString,
		team: z
			.string()
			.trim()
			.optional()
			.transform((value) => (value === "" ? undefined : value)),
	})
	.transform((row) => ({
		lastName: row.last_name,
		firstName: row.first_name,
		id: row.id,
		...("team" in row && row.team != null ? { team: row.team } : {}),
	}));

export const studentRowsSchema = z.array(studentRowSchema);

export const assessmentRowSchema = z
	.object({
		submission_type: z.enum(["individual", "team"]),
		submitter: nonEmptyString,
	})
	.catchall(z.string());

export const assessmentRowsSchema = z.array(assessmentRowSchema);

export { questionsSchema, rubricSchema };
