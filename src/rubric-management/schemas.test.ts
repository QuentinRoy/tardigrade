import { describe, expect, it } from "vitest";
import { rubricDefinitionSchema } from "./schemas.ts";

// Number's bounds check is a cross-field `superRefine`, kept here (not moved
// into numberSchemas.test.ts) as the one composed-path proof that a per-kind
// refine's relative issue path (e.g. `path: ["maxValue"]`) still resolves to
// `criteria.0.maxValue` once embedded in the full rubric schema. Zod's path
// composition is identical regardless of which kind's refine triggers it, so
// this single block stands in for all three kinds; per-kind message/refine
// content lives in each kind's own `{kind}Schemas.test.ts`.
function buildNumberRubric(overrides: {
	minValue: number;
	maxValue: number;
	minMarks: number;
	maxMarks: number;
}) {
	return {
		id: "q1",
		criteria: [{ id: "r1", kind: "number", reversed: false, ...overrides }],
	};
}

describe("rubricDefinitionSchema number criterion bounds", () => {
	it("rejects a number criterion with minValue === maxValue", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumberRubric({
				minValue: 5,
				maxValue: 5,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.maxValue",
		);
		expect(issue?.message).toBe("Max value must be greater than min value");
	});

	it("rejects a number criterion with minValue > maxValue", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumberRubric({
				minValue: 10,
				maxValue: 5,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.maxValue",
		);
		expect(issue?.message).toBe("Max value must be greater than min value");
	});

	it("accepts a number criterion with minValue < maxValue", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumberRubric({
				minValue: 0,
				maxValue: 10,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(true);
	});

	it("rejects a number criterion with minMarks > maxMarks", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumberRubric({
				minValue: 0,
				maxValue: 10,
				minMarks: 10,
				maxMarks: 0,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.maxMarks",
		);
		expect(issue?.message).toBe(
			"Max marks must be greater than or equal to min marks",
		);
	});

	it("accepts a number criterion with minMarks === maxMarks", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumberRubric({
				minValue: 0,
				maxValue: 10,
				minMarks: 5,
				maxMarks: 5,
			}),
		);

		expect(result.success).toBe(true);
	});

	it("accepts a number criterion with minMarks < maxMarks", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumberRubric({
				minValue: 0,
				maxValue: 10,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(true);
	});
});
