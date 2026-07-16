import { describe, expect, it } from "vitest";
import { markNumberCriterion } from "./criterion.ts";

function numberCriterion(
	overrides: Partial<Parameters<typeof markNumberCriterion>[0]> = {},
) {
	return {
		id: "r1",
		kind: "number" as const,
		minValue: 0,
		maxValue: 10,
		minMarks: 0,
		maxMarks: 5,
		reversed: false,
		...overrides,
	};
}

describe("markNumberCriterion", () => {
	it("maps low values to low marks by default", () => {
		expect(markNumberCriterion(numberCriterion(), 2)).toBe(1);
	});

	it("reverses the mapping when requested", () => {
		expect(markNumberCriterion(numberCriterion({ reversed: true }), 2)).toBe(4);
	});

	it("maps minValue to minMarks when not reversed", () => {
		expect(markNumberCriterion(numberCriterion(), 0)).toBe(0);
	});

	it("maps maxValue to maxMarks when not reversed", () => {
		expect(markNumberCriterion(numberCriterion(), 10)).toBe(5);
	});

	it("maps minValue to maxMarks when reversed", () => {
		expect(markNumberCriterion(numberCriterion({ reversed: true }), 0)).toBe(5);
	});

	it("maps maxValue to minMarks when reversed", () => {
		expect(markNumberCriterion(numberCriterion({ reversed: true }), 10)).toBe(
			0,
		);
	});

	it("interpolates mid-range values with a non-zero minMarks", () => {
		expect(
			markNumberCriterion(
				numberCriterion({
					minValue: 0,
					maxValue: 10,
					minMarks: 2,
					maxMarks: 7,
				}),
				4,
			),
		).toBe(4);
	});

	it("interpolates mid-range values with negative marks", () => {
		expect(
			markNumberCriterion(
				numberCriterion({
					minValue: 0,
					maxValue: 10,
					minMarks: -5,
					maxMarks: 5,
				}),
				5,
			),
		).toBe(0);
	});

	it("tolerates inverted marks (minMarks > maxMarks), returning the descending value", () => {
		expect(
			markNumberCriterion(numberCriterion({ minMarks: 5, maxMarks: 0 }), 2),
		).toBe(4);
	});

	it("throws when minValue equals maxValue (zero-width value range)", () => {
		expect(() =>
			markNumberCriterion(numberCriterion({ minValue: 5, maxValue: 5 }), 5),
		).toThrow(
			"Cannot mark a number criterion with a zero-width value range (minValue and maxValue are both 5)",
		);
	});

	it("returns the finite descending value when minValue is greater than maxValue (inverted range)", () => {
		expect(
			markNumberCriterion(
				numberCriterion({
					minValue: 10,
					maxValue: 5,
					minMarks: 0,
					maxMarks: 10,
				}),
				7,
			),
		).toBe(6);
	});

	it("extrapolates a value above maxValue instead of throwing", () => {
		expect(markNumberCriterion(numberCriterion(), 12)).toBe(6);
	});

	it("extrapolates a value below minValue instead of throwing", () => {
		expect(markNumberCriterion(numberCriterion(), -2)).toBe(-1);
	});
});
