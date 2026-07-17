import { describe, expect, it } from "vitest";
import {
	isNumberMarksRangeValid,
	isNumberValueRangeValid,
} from "./numberBounds.ts";

describe("isNumberValueRangeValid", () => {
	it("accepts a strictly increasing value range and rejects the rest", () => {
		expect(isNumberValueRangeValid({ minValue: 0, maxValue: 10 })).toBe(true);
		expect(isNumberValueRangeValid({ minValue: 5, maxValue: 5 })).toBe(false);
		expect(isNumberValueRangeValid({ minValue: 10, maxValue: 5 })).toBe(false);
	});
});

describe("isNumberMarksRangeValid", () => {
	it("accepts a non-decreasing marks range and rejects an inverted one", () => {
		expect(isNumberMarksRangeValid({ minMarks: 0, maxMarks: 5 })).toBe(true);
		expect(isNumberMarksRangeValid({ minMarks: 5, maxMarks: 5 })).toBe(true);
		expect(isNumberMarksRangeValid({ minMarks: 10, maxMarks: 0 })).toBe(false);
	});
});
