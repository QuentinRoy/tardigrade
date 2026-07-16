import { z } from "zod";
import { checkCriterionImportSchema } from "#criteria/check/checkSchemas.ts";
import {
	baseImportCriterionSchema,
	importNonEmptyString as nonEmptyString,
	importNumericValue as numericValue,
} from "#criteria/criterionSchemaAtoms.ts";
import { numberCriterionImportSchema } from "#criteria/number/numberSchemas.ts";

const optionsMarksSchema = z
	.record(nonEmptyString, numericValue)
	.refine((marks) => Object.keys(marks).length >= 2, {
		message: "Options criterion must have at least 2 mark entries",
	});

export const optionsCriterionSchema = baseImportCriterionSchema
	.extend({ kind: z.literal("options"), marks: optionsMarksSchema })
	.strict();

const criterionSchema = z.discriminatedUnion("kind", [
	checkCriterionImportSchema,
	optionsCriterionSchema,
	numberCriterionImportSchema,
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

export const gradeRowSchema = z
	.object({ kind: z.enum(["individual", "group"]), name: nonEmptyString })
	.catchall(z.string());

export const gradeRowsSchema = z.array(gradeRowSchema);

export { criterionSchema, rubricsSchema };
