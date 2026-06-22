import { describe, expect, it } from "vitest";
import { markBooleanRubric, markNumericalRubric } from "./rubric.ts";

function numericalRubric(
	overrides: Partial<Parameters<typeof markNumericalRubric>[0]> = {},
) {
	return {
		id: "r1",
		type: "numerical" as const,
		minScore: 0,
		maxScore: 10,
		minMarks: 0,
		maxMarks: 5,
		reversed: false,
		...overrides,
	};
}

describe("markNumericalRubric", () => {
	it("maps low scores to low marks by default", () => {
		expect(markNumericalRubric(numericalRubric(), 2)).toBe(1);
	});

	it("reverses the mapping when requested", () => {
		expect(markNumericalRubric(numericalRubric({ reversed: true }), 2)).toBe(4);
	});

	it("maps minScore to minMarks when not reversed", () => {
		expect(markNumericalRubric(numericalRubric(), 0)).toBe(0);
	});

	it("maps maxScore to maxMarks when not reversed", () => {
		expect(markNumericalRubric(numericalRubric(), 10)).toBe(5);
	});

	it("maps minScore to maxMarks when reversed", () => {
		expect(markNumericalRubric(numericalRubric({ reversed: true }), 0)).toBe(5);
	});

	it("maps maxScore to minMarks when reversed", () => {
		expect(markNumericalRubric(numericalRubric({ reversed: true }), 10)).toBe(
			0,
		);
	});

	it("interpolates mid-range scores with a non-zero minMarks", () => {
		expect(
			markNumericalRubric(
				numericalRubric({
					minScore: 0,
					maxScore: 10,
					minMarks: 2,
					maxMarks: 7,
				}),
				4,
			),
		).toBe(4);
	});

	it("interpolates mid-range scores with negative marks", () => {
		expect(
			markNumericalRubric(
				numericalRubric({
					minScore: 0,
					maxScore: 10,
					minMarks: -5,
					maxMarks: 5,
				}),
				5,
			),
		).toBe(0);
	});

	it("tolerates inverted marks (minMarks > maxMarks), returning the descending value", () => {
		expect(
			markNumericalRubric(numericalRubric({ minMarks: 5, maxMarks: 0 }), 2),
		).toBe(4);
	});

	it("throws when minScore equals maxScore (zero-width score range)", () => {
		expect(() =>
			markNumericalRubric(numericalRubric({ minScore: 5, maxScore: 5 }), 5),
		).toThrow(
			"Cannot mark a numerical rubric with a zero-width score range (minScore and maxScore are both 5)",
		);
	});

	it("returns the finite descending value when minScore is greater than maxScore (inverted range)", () => {
		expect(
			markNumericalRubric(
				numericalRubric({
					minScore: 10,
					maxScore: 5,
					minMarks: 0,
					maxMarks: 10,
				}),
				7,
			),
		).toBe(6);
	});

	it("extrapolates a score above maxScore instead of throwing", () => {
		expect(markNumericalRubric(numericalRubric(), 12)).toBe(6);
	});

	it("extrapolates a score below minScore instead of throwing", () => {
		expect(markNumericalRubric(numericalRubric(), -2)).toBe(-1);
	});
});

describe("markBooleanRubric", () => {
	it("returns marks when passed", () => {
		expect(
			markBooleanRubric(
				{ id: "r1", type: "boolean", marks: 2, falseMarks: -1 },
				true,
			),
		).toBe(2);
	});

	it("returns falseMarks when not passed", () => {
		expect(
			markBooleanRubric(
				{ id: "r1", type: "boolean", marks: 2, falseMarks: -1 },
				false,
			),
		).toBe(-1);
	});
});
