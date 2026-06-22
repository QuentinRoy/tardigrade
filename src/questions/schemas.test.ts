import { describe, expect, it } from "vitest";
import { questionDefinitionSchema } from "./schemas.ts";

function buildQuestion(marks: Record<string, number>) {
	return { id: "q1", rubrics: [{ id: "r1", type: "ordinal", marks }] };
}

describe("questionDefinitionSchema ordinal marks", () => {
	it("rejects an ordinal rubric with 0 mark entries", () => {
		const result = questionDefinitionSchema.safeParse(buildQuestion({}));

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "rubrics.0.marks",
		);
		expect(issue?.message).toBe(
			"Ordinal rubric must have at least 2 mark entries",
		);
	});

	it("rejects an ordinal rubric with 1 mark entry", () => {
		const result = questionDefinitionSchema.safeParse(buildQuestion({ A: 1 }));

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "rubrics.0.marks",
		);
		expect(issue?.message).toBe(
			"Ordinal rubric must have at least 2 mark entries",
		);
	});

	it("accepts an ordinal rubric with 2 mark entries", () => {
		const result = questionDefinitionSchema.safeParse(
			buildQuestion({ A: 2, B: 1 }),
		);

		expect(result.success).toBe(true);
	});
});

describe("questionDefinitionSchema numeric rubric fields", () => {
	// An emptied numeric field reports NaN, which serializes to null in the
	// submitted payload; these assert the resulting messages and paths.
	it("rejects a boolean rubric whose marks are not a number", () => {
		const result = questionDefinitionSchema.safeParse({
			id: "q1",
			rubrics: [{ id: "r1", type: "boolean", marks: null }],
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "rubrics.0.marks",
		);
		expect(issue?.message).toBe("Marks must be a valid number");
	});

	it("rejects a boolean rubric whose false marks are not a number", () => {
		const result = questionDefinitionSchema.safeParse({
			id: "q1",
			rubrics: [{ id: "r1", type: "boolean", marks: 1, falseMarks: null }],
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "rubrics.0.falseMarks",
		);
		expect(issue?.message).toBe("False marks must be a valid number");
	});

	it("reports each invalid numerical field with its own message", () => {
		const result = questionDefinitionSchema.safeParse({
			id: "q1",
			rubrics: [
				{
					id: "r1",
					type: "numerical",
					minScore: null,
					maxScore: null,
					minMarks: null,
					maxMarks: null,
					reversed: false,
				},
			],
		});

		expect(result.success).toBe(false);
		const messageByPath = new Map(
			result.error?.issues.map((issue) => [
				issue.path.join("."),
				issue.message,
			]),
		);
		expect(messageByPath.get("rubrics.0.minScore")).toBe(
			"Min score must be a valid number",
		);
		expect(messageByPath.get("rubrics.0.maxScore")).toBe(
			"Max score must be a valid number",
		);
		expect(messageByPath.get("rubrics.0.minMarks")).toBe(
			"Min marks must be a valid number",
		);
		expect(messageByPath.get("rubrics.0.maxMarks")).toBe(
			"Max marks must be a valid number",
		);
	});
});

function buildNumericalQuestion(overrides: {
	minScore: number;
	maxScore: number;
	minMarks: number;
	maxMarks: number;
}) {
	return {
		id: "q1",
		rubrics: [{ id: "r1", type: "numerical", reversed: false, ...overrides }],
	};
}

describe("questionDefinitionSchema numerical rubric bounds", () => {
	it("rejects a numerical rubric with minScore === maxScore", () => {
		const result = questionDefinitionSchema.safeParse(
			buildNumericalQuestion({
				minScore: 5,
				maxScore: 5,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "rubrics.0.maxScore",
		);
		expect(issue?.message).toBe("Max score must be greater than min score");
	});

	it("rejects a numerical rubric with minScore > maxScore", () => {
		const result = questionDefinitionSchema.safeParse(
			buildNumericalQuestion({
				minScore: 10,
				maxScore: 5,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "rubrics.0.maxScore",
		);
		expect(issue?.message).toBe("Max score must be greater than min score");
	});

	it("accepts a numerical rubric with minScore < maxScore", () => {
		const result = questionDefinitionSchema.safeParse(
			buildNumericalQuestion({
				minScore: 0,
				maxScore: 10,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(true);
	});

	it("rejects a numerical rubric with minMarks > maxMarks", () => {
		const result = questionDefinitionSchema.safeParse(
			buildNumericalQuestion({
				minScore: 0,
				maxScore: 10,
				minMarks: 10,
				maxMarks: 0,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "rubrics.0.maxMarks",
		);
		expect(issue?.message).toBe(
			"Max marks must be greater than or equal to min marks",
		);
	});

	it("accepts a numerical rubric with minMarks === maxMarks", () => {
		const result = questionDefinitionSchema.safeParse(
			buildNumericalQuestion({
				minScore: 0,
				maxScore: 10,
				minMarks: 5,
				maxMarks: 5,
			}),
		);

		expect(result.success).toBe(true);
	});

	it("accepts a numerical rubric with minMarks < maxMarks", () => {
		const result = questionDefinitionSchema.safeParse(
			buildNumericalQuestion({
				minScore: 0,
				maxScore: 10,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(true);
	});
});
