import { describe, expect, it } from "vitest";
import {
	numberCriterionEditorSchema,
	numberCriterionImportSchema,
} from "./numberSchemas.ts";

describe("numberCriterionEditorSchema", () => {
	it("reports each invalid number field with its own message", () => {
		const result = numberCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "number",
			minValue: null,
			maxValue: null,
			minMarks: null,
			maxMarks: null,
			reversed: false,
		});

		expect(result.success).toBe(false);
		const messageByPath = new Map(
			result.error?.issues.map((issue) => [
				issue.path.join("."),
				issue.message,
			]),
		);
		expect(messageByPath.get("minValue")).toBe(
			"Min value must be a valid number",
		);
		expect(messageByPath.get("maxValue")).toBe(
			"Max value must be a valid number",
		);
		expect(messageByPath.get("minMarks")).toBe(
			"Min marks must be a valid number",
		);
		expect(messageByPath.get("maxMarks")).toBe(
			"Max marks must be a valid number",
		);
	});

	it("accepts a valid bounds configuration", () => {
		const result = numberCriterionEditorSchema.safeParse({
			id: "r1",
			kind: "number",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		});

		expect(result.success).toBe(true);
	});
});

describe("numberCriterionImportSchema", () => {
	it("applies defaults for omitted bounds fields", () => {
		const result = numberCriterionImportSchema.safeParse({
			id: "r1",
			kind: "number",
			maxMarks: 5,
		});

		expect(result).toMatchObject({
			success: true,
			data: {
				id: "r1",
				kind: "number",
				minValue: 0,
				maxValue: 1,
				minMarks: 0,
				maxMarks: 5,
				reversed: false,
			},
		});
	});

	it("rejects a value range with minValue === maxValue", () => {
		const result = numberCriterionImportSchema.safeParse({
			id: "r1",
			kind: "number",
			minValue: 5,
			maxValue: 5,
			maxMarks: 5,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(
			"minValue must be less than maxValue",
		);
	});

	it("rejects a marks range with minMarks greater than maxMarks", () => {
		const result = numberCriterionImportSchema.safeParse({
			id: "r1",
			kind: "number",
			minMarks: 5,
			maxMarks: 0,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(
			"minMarks must be less than or equal to maxMarks",
		);
	});

	it("rejects a criterion providing neither minMarks nor maxMarks", () => {
		const result = numberCriterionImportSchema.safeParse({
			id: "r1",
			kind: "number",
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(
			"Number criterion must provide at least one of minMarks or maxMarks",
		);
	});

	it("rejects minValue without maxValue", () => {
		const result = numberCriterionImportSchema.safeParse({
			id: "r1",
			kind: "number",
			minValue: 0,
			maxMarks: 5,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(
			"maxValue must be provided when minValue is provided",
		);
	});

	it("rejects omitted minMarks with a maxMarks of 0", () => {
		const result = numberCriterionImportSchema.safeParse({
			id: "r1",
			kind: "number",
			maxMarks: 0,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(
			"When minMarks is omitted, maxMarks must be greater than 0",
		);
	});

	it("rejects omitted maxMarks with a non-negative minMarks", () => {
		const result = numberCriterionImportSchema.safeParse({
			id: "r1",
			kind: "number",
			minMarks: 0,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(
			"When maxMarks is omitted, minMarks must be less than 0",
		);
	});
});
