import { describe, expect, it } from "vitest";
import { rubricDefinitionSchema } from "./schemas.ts";

function buildRubric(marks: Record<string, number>) {
	return { id: "q1", criteria: [{ id: "r1", kind: "options", marks }] };
}

describe("rubricDefinitionSchema options marks", () => {
	it("rejects an options criterion with 0 mark entries", () => {
		const result = rubricDefinitionSchema.safeParse(buildRubric({}));

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.marks",
		);
		expect(issue?.message).toBe(
			"Options criterion must have at least 2 mark entries",
		);
	});

	it("rejects an options criterion with 1 mark entry", () => {
		const result = rubricDefinitionSchema.safeParse(buildRubric({ A: 1 }));

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.marks",
		);
		expect(issue?.message).toBe(
			"Options criterion must have at least 2 mark entries",
		);
	});

	it("accepts an options criterion with 2 mark entries", () => {
		const result = rubricDefinitionSchema.safeParse(
			buildRubric({ A: 2, B: 1 }),
		);

		expect(result.success).toBe(true);
	});
});

describe("rubricDefinitionSchema numeric criterion fields", () => {
	// An emptied numeric field reports NaN, which serializes to null in the
	// submitted payload; these assert the resulting messages and paths.
	it("rejects a check criterion whose marks are not a number", () => {
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

	it("rejects a check criterion whose false marks are not a number", () => {
		const result = rubricDefinitionSchema.safeParse({
			id: "q1",
			criteria: [{ id: "r1", kind: "check", marks: 1, falseMarks: null }],
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "criteria.0.falseMarks",
		);
		expect(issue?.message).toBe("Enter a valid number for No marks.");
	});

	it("reports each invalid number field with its own message", () => {
		const result = rubricDefinitionSchema.safeParse({
			id: "q1",
			criteria: [
				{
					id: "r1",
					kind: "number",
					minValue: null,
					maxValue: null,
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
		expect(messageByPath.get("criteria.0.minValue")).toBe(
			"Min value must be a valid number",
		);
		expect(messageByPath.get("criteria.0.maxValue")).toBe(
			"Max value must be a valid number",
		);
		expect(messageByPath.get("criteria.0.minMarks")).toBe(
			"Min marks must be a valid number",
		);
		expect(messageByPath.get("criteria.0.maxMarks")).toBe(
			"Max marks must be a valid number",
		);
	});
});

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
