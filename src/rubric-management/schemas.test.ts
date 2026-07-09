import { describe, expect, it } from "vitest";
import { rubricDefinitionSchema } from "./schemas.ts";

function buildRubric(marks: Record<string, number>) {
	return { id: "q1", criteria: [{ id: "r1", kind: "options", marks }] };
}

describe("rubricDefinitionSchema ordinal marks", () => {
	it("rejects an ordinal criterion with 0 mark entries", () => {
		const result = rubricDefinitionSchema.safeParse(buildRubric({}));

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.marks",
		);
		expect(issue?.message).toBe(
			"Options criterion must have at least 2 mark entries",
		);
	});

	it("rejects an ordinal criterion with 1 mark entry", () => {
		const result = rubricDefinitionSchema.safeParse(buildRubric({ A: 1 }));

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.marks",
		);
		expect(issue?.message).toBe(
			"Options criterion must have at least 2 mark entries",
		);
	});

	it("accepts an ordinal criterion with 2 mark entries", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildRubric({ A: 2, B: 1 }),
		);

		expect(result.success).toBe(true);
	});
});

describe("rubricDefinitionSchema numeric criterion fields", () => {
	// An emptied numeric field reports NaN, which serializes to null in the
	// submitted payload; these assert the resulting messages and paths.
	it("rejects a boolean criterion whose marks are not a number", () => {
		const result = rubricDefinitionSchema.safeParse({
			id: "q1",
			criteria: [{ id: "r1", kind: "check", marks: null }],
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.marks",
		);
		expect(issue?.message).toBe("Marks must be a valid number");
	});

	it("rejects a boolean criterion whose false marks are not a number", () => {
		const result = rubricDefinitionSchema.safeParse({
			id: "q1",
			criteria: [{ id: "r1", kind: "check", marks: 1, falseMarks: null }],
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.falseMarks",
		);
		expect(issue?.message).toBe("False marks must be a valid number");
	});

	it("reports each invalid numerical field with its own message", () => {
		const result = rubricDefinitionSchema.safeParse({
			id: "q1",
			criteria: [
				{
					id: "r1",
					kind: "number",
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
		expect(messageByPath.get("criteria.0.minScore")).toBe(
			"Min score must be a valid number",
		);
		expect(messageByPath.get("criteria.0.maxScore")).toBe(
			"Max score must be a valid number",
		);
		expect(messageByPath.get("criteria.0.minMarks")).toBe(
			"Min marks must be a valid number",
		);
		expect(messageByPath.get("criteria.0.maxMarks")).toBe(
			"Max marks must be a valid number",
		);
	});
});

function buildNumericalRubric(overrides: {
	minScore: number;
	maxScore: number;
	minMarks: number;
	maxMarks: number;
}) {
	return {
		id: "q1",
		criteria: [{ id: "r1", kind: "number", reversed: false, ...overrides }],
	};
}

describe("rubricDefinitionSchema numerical criterion bounds", () => {
	it("rejects a numerical criterion with minScore === maxScore", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumericalRubric({
				minScore: 5,
				maxScore: 5,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.maxScore",
		);
		expect(issue?.message).toBe("Max score must be greater than min score");
	});

	it("rejects a numerical criterion with minScore > maxScore", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumericalRubric({
				minScore: 10,
				maxScore: 5,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.maxScore",
		);
		expect(issue?.message).toBe("Max score must be greater than min score");
	});

	it("accepts a numerical criterion with minScore < maxScore", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumericalRubric({
				minScore: 0,
				maxScore: 10,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(true);
	});

	it("rejects a numerical criterion with minMarks > maxMarks", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumericalRubric({
				minScore: 0,
				maxScore: 10,
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

	it("accepts a numerical criterion with minMarks === maxMarks", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumericalRubric({
				minScore: 0,
				maxScore: 10,
				minMarks: 5,
				maxMarks: 5,
			}),
		);

		expect(result.success).toBe(true);
	});

	it("accepts a numerical criterion with minMarks < maxMarks", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildNumericalRubric({
				minScore: 0,
				maxScore: 10,
				minMarks: 0,
				maxMarks: 10,
			}),
		);

		expect(result.success).toBe(true);
	});
});
