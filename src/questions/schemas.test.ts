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
