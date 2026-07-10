import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const numericValue = z.number();

const baseCriterionSchema = z.object({
	id: nonEmptyString,
	description: nonEmptyString.optional(),
	label: nonEmptyString.optional(),
	kind: z.string(),
});

export const checkCriterionSchema = baseCriterionSchema.extend({
	kind: z.literal("check"),
	marks: numericValue,
	falseMarks: numericValue.optional(),
});

const optionsMarksSchema = z
	.record(nonEmptyString, numericValue)
	.refine((marks) => Object.keys(marks).length >= 2, {
		message: "Options criterion must have at least 2 mark entries",
	});

export const optionsCriterionSchema = baseCriterionSchema.extend({
	kind: z.literal("options"),
	marks: optionsMarksSchema,
});

export const numberCriterionSchema = baseCriterionSchema
	.extend({
		kind: z.literal("number"),
		minScore: numericValue.optional(),
		maxScore: numericValue.optional(),
		minMarks: numericValue.optional(),
		maxMarks: numericValue.optional(),
		reversed: z.boolean().optional(),
	})
	.refine((r) => r.minMarks != null || r.maxMarks != null, {
		message:
			"Number criterion must provide at least one of minMarks or maxMarks",
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

const criterionSchema = z.discriminatedUnion("kind", [
	checkCriterionSchema,
	optionsCriterionSchema,
	numberCriterionSchema,
]);

export const rubricSchema = z.object({
	id: nonEmptyString,
	label: nonEmptyString.optional(),
	criteria: z
		.array(criterionSchema)
		.refine(
			(criteria) => new Set(criteria.map((r) => r.id)).size === criteria.length,
			{ message: "Criterion ids must be unique within a rubric" },
		),
});

const rubricsSchema = z
	.object(
		{
			rubrics: z
				.array(rubricSchema)
				.refine(
					(rubrics) =>
						new Set(rubrics.map((rubric) => rubric.id)).size === rubrics.length,
					{ message: "Rubric ids must be unique" },
				),
		},
		{
			// Turn Zod's terse "Unrecognized key" into an actionable message. Only
			// overrides unrecognized-key errors; returning undefined leaves every
			// other message untouched.
			error: (issue) => {
				if (issue.code !== "unrecognized_keys") {
					return undefined;
				}
				const names = issue.keys.map((key) => `"${key}"`).join(", ");
				const plural = issue.keys.length > 1;
				return `Unexpected top-level ${plural ? "entries" : "entry"} ${names}. A rubrics file must contain a single top-level "rubrics:" list — remove ${plural ? "them" : "it"} or fix the spelling, then import again.`;
			},
		},
	)
	// Reject unknown top-level keys so an old-format file fails loudly (see the
	// error message above) instead of being silently stripped and reported only
	// as a missing `rubrics:`.
	.strict();

export const studentRowSchema = z
	.object({
		last_name: nonEmptyString,
		first_name: nonEmptyString,
		id: nonEmptyString,
		group: z
			.string()
			.trim()
			.optional()
			.transform((value) => (value === "" ? undefined : value)),
	})
	.transform((row) => ({
		lastName: row.last_name,
		firstName: row.first_name,
		id: row.id,
		...("group" in row && row.group != null ? { group: row.group } : {}),
	}));

export const studentRowsSchema = z.array(studentRowSchema);

export const assessmentRowSchema = z
	.object({
		submission_type: z.enum(["individual", "group"]),
		submitter: nonEmptyString,
	})
	.catchall(z.string());

export const assessmentRowsSchema = z.array(assessmentRowSchema);

export { criterionSchema, rubricsSchema };
