import { describe, expect, it } from "vitest";
import type {
	NumberCriterion,
	NumberCriterionGradeContent,
} from "./numberDomain.ts";
import {
	describeNumber,
	encodeNumberCriterion,
	exportNumberGradeValue,
	getNumberCriterionMaxMarks,
	getNumberCriterionMinMarks,
	isSameNumberGrade,
	markNumberCriterion,
	parseNumberGradeValue,
	toNumberCriterionDefinitionInput,
} from "./numberDomain.ts";

function numberCriterion(
	overrides: Partial<NumberCriterion> = {},
): NumberCriterion {
	return {
		id: "r1",
		kind: "number",
		minValue: 0,
		maxValue: 10,
		minMarks: 0,
		maxMarks: 5,
		reversed: false,
		...overrides,
	};
}

function gradedNumberCriterion(
	grade: NumberCriterionGradeContent,
	overrides: Partial<NumberCriterion> = {},
) {
	return { ...numberCriterion(overrides), grade };
}

describe("markNumberCriterion", () => {
	it("maps low values to low marks by default", () => {
		expect(markNumberCriterion(gradedNumberCriterion({ value: 2 }))).toBe(1);
	});

	it("reverses the mapping when requested", () => {
		expect(
			markNumberCriterion(
				gradedNumberCriterion({ value: 2 }, { reversed: true }),
			),
		).toBe(4);
	});

	it("maps minValue to minMarks when not reversed", () => {
		expect(markNumberCriterion(gradedNumberCriterion({ value: 0 }))).toBe(0);
	});

	it("maps maxValue to maxMarks when not reversed", () => {
		expect(markNumberCriterion(gradedNumberCriterion({ value: 10 }))).toBe(5);
	});

	it("maps minValue to maxMarks when reversed", () => {
		expect(
			markNumberCriterion(
				gradedNumberCriterion({ value: 0 }, { reversed: true }),
			),
		).toBe(5);
	});

	it("maps maxValue to minMarks when reversed", () => {
		expect(
			markNumberCriterion(
				gradedNumberCriterion({ value: 10 }, { reversed: true }),
			),
		).toBe(0);
	});

	it("interpolates mid-range values with a non-zero minMarks", () => {
		expect(
			markNumberCriterion(
				gradedNumberCriterion(
					{ value: 4 },
					{ minValue: 0, maxValue: 10, minMarks: 2, maxMarks: 7 },
				),
			),
		).toBe(4);
	});

	it("interpolates mid-range values with negative marks", () => {
		expect(
			markNumberCriterion(
				gradedNumberCriterion(
					{ value: 5 },
					{ minValue: 0, maxValue: 10, minMarks: -5, maxMarks: 5 },
				),
			),
		).toBe(0);
	});

	it("tolerates inverted marks (minMarks > maxMarks), returning the descending value", () => {
		expect(
			markNumberCriterion(
				gradedNumberCriterion({ value: 2 }, { minMarks: 5, maxMarks: 0 }),
			),
		).toBe(4);
	});

	it("throws when minValue equals maxValue (zero-width value range)", () => {
		expect(() =>
			markNumberCriterion(
				gradedNumberCriterion({ value: 5 }, { minValue: 5, maxValue: 5 }),
			),
		).toThrow(
			"Cannot mark a number criterion with a zero-width value range (minValue and maxValue are both 5)",
		);
	});

	it("returns the finite descending value when minValue is greater than maxValue (inverted range)", () => {
		expect(
			markNumberCriterion(
				gradedNumberCriterion(
					{ value: 7 },
					{ minValue: 10, maxValue: 5, minMarks: 0, maxMarks: 10 },
				),
			),
		).toBe(6);
	});

	it("extrapolates a value above maxValue instead of throwing", () => {
		expect(markNumberCriterion(gradedNumberCriterion({ value: 12 }))).toBe(6);
	});

	it("extrapolates a value below minValue instead of throwing", () => {
		expect(markNumberCriterion(gradedNumberCriterion({ value: -2 }))).toBe(-1);
	});
});

describe("number criterion marks bounds", () => {
	it("reports maxMarks as the max and minMarks as the min", () => {
		const criterion = numberCriterion({ minMarks: -3, maxMarks: 7 });
		expect(getNumberCriterionMaxMarks(criterion)).toBe(7);
		expect(getNumberCriterionMinMarks(criterion)).toBe(-3);
	});
});

describe("describeNumber", () => {
	it("projects the bounds as neutral display facts", () => {
		expect(describeNumber(numberCriterion({ reversed: true }))).toEqual({
			kind: "number",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: true,
		});
	});
});

describe("exportNumberGradeValue", () => {
	it("projects the graded value as the CSV cell value", () => {
		expect(exportNumberGradeValue({ value: 3.5 })).toBe(3.5);
	});
});

describe("parseNumberGradeValue", () => {
	it("accepts decimal and negative cells", () => {
		expect(parseNumberGradeValue("3.5")).toEqual({ value: 3.5 });
		expect(parseNumberGradeValue("-2")).toEqual({ value: -2 });
	});

	it("rejects a cell that is not a number", () => {
		expect(() => parseNumberGradeValue("many")).toThrow(
			'Invalid number value "many"',
		);
	});
});

describe("isSameNumberGrade", () => {
	it("compares the graded value", () => {
		expect(isSameNumberGrade({ value: 3 }, { value: 3 })).toBe(true);
		expect(isSameNumberGrade({ value: 3 }, { value: 3.5 })).toBe(false);
	});
});

describe("toNumberCriterionDefinitionInput", () => {
	it("keeps the stored id as previousId", () => {
		expect(
			toNumberCriterionDefinitionInput(numberCriterion({ label: "Value" })),
		).toEqual({
			previousId: "r1",
			id: "r1",
			description: undefined,
			label: "Value",
			kind: "number",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		});
	});
});

describe("encodeNumberCriterion", () => {
	it("emits the bounds and omits absent optional text", () => {
		expect(encodeNumberCriterion(numberCriterion())).toEqual({
			id: "r1",
			kind: "number",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		});
	});

	it("includes label and description when present", () => {
		expect(
			encodeNumberCriterion(
				numberCriterion({ label: "Value", description: "How much" }),
			),
		).toEqual({
			id: "r1",
			kind: "number",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
			label: "Value",
			description: "How much",
		});
	});
});
