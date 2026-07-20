import { describe, expect, it } from "vitest";
import {
	checkCriterionEditorSchema,
	checkCriterionImportSchema,
} from "./checkSchemas.ts";

describe("checkCriterionEditorSchema", () => {
	it("rejects marks that are not a number", () => {
		const result = checkCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "check",
			marks: null,
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "marks",
		);
		expect(issue?.message).toBe("Marks must be a valid number");
	});

	it("rejects false marks that are not a number", () => {
		const result = checkCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "check",
			marks: 1,
			falseMarks: null,
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "falseMarks",
		);
		expect(issue?.message).toBe("Enter a valid number for No marks.");
	});

	it("accepts a criterion without falseMarks", () => {
		const result = checkCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "check",
			marks: 2,
		});

		expect(result.success).toBe(true);
	});
});

describe("checkCriterionImportSchema", () => {
	it("accepts marks and falseMarks", () => {
		const result = checkCriterionImportSchema.safeParse({
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: -1,
		});

		expect(result).toMatchObject({
			success: true,
			data: { id: "r1", kind: "check", marks: 2, falseMarks: -1 },
		});
	});

	it("accepts a criterion without falseMarks", () => {
		const result = checkCriterionImportSchema.safeParse({
			id: "r1",
			kind: "check",
			marks: 2,
		});

		expect(result.success).toBe(true);
	});
});
