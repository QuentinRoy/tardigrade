import { describe, expect, it } from "vitest";
import {
	optionsCriterionEditorSchema,
	optionsCriterionImportSchema,
} from "./optionsSchemas.ts";

describe("optionsCriterionEditorSchema", () => {
	it("rejects a criterion with 0 mark entries", () => {
		const result = optionsCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "options",
			marks: {},
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "marks",
		);
		expect(issue?.message).toBe(
			"Options criterion must have at least 2 mark entries",
		);
	});

	it("rejects a criterion with 1 mark entry", () => {
		const result = optionsCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "options",
			marks: { A: 1 },
		});

		expect(result.success).toBe(false);
		const issue = result.error?.issues.find(
			(issue) => issue.path.join(".") === "marks",
		);
		expect(issue?.message).toBe(
			"Options criterion must have at least 2 mark entries",
		);
	});

	it("accepts a criterion with 2 mark entries", () => {
		const result = optionsCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "options",
			marks: { A: 2, B: 1 },
		});

		expect(result.success).toBe(true);
	});
});

describe("optionsCriterionImportSchema", () => {
	it("rejects a criterion with fewer than 2 mark entries", () => {
		const result = optionsCriterionImportSchema.safeParse({
			id: "r1",
			kind: "options",
			marks: { A: 1 },
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(
			"Options criterion must have at least 2 mark entries",
		);
	});

	it("accepts a criterion with 2 mark entries", () => {
		const result = optionsCriterionImportSchema.safeParse({
			id: "r1",
			kind: "options",
			marks: { A: 2, B: 1 },
		});

		expect(result.success).toBe(true);
	});
});
