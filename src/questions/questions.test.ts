import { describe, expect, test } from "vitest";
import { questionCacheTags, toRubric } from "./questions.ts";

test("questionCacheTags declares the questions tag", () => {
	expect(questionCacheTags()).toEqual(["questions"]);
});

describe("toRubric", () => {
	const base = { description: null, label: null };

	describe("ordinal", () => {
		test("throws when ordinalRubric row is missing (Rubric Subtype Invariant violation)", () => {
			expect(() =>
				toRubric({
					...base,
					id: "r1",
					type: "ordinal",
					ordinalRubric: null,
					booleanRubric: null,
					numericalRubric: null,
				}),
			).toThrow();
		});

		test("maps to { type: 'ordinal', marks: {} } when ordinalRubric row exists with zero values", () => {
			expect(
				toRubric({
					...base,
					id: "r1",
					type: "ordinal",
					ordinalRubric: { marks: [] },
					booleanRubric: null,
					numericalRubric: null,
				}),
			).toMatchObject({ id: "r1", type: "ordinal", marks: {} });
		});

		test("maps marks correctly", () => {
			expect(
				toRubric({
					...base,
					id: "r1",
					type: "ordinal",
					ordinalRubric: {
						marks: [
							{ label: "A", marks: 4 },
							{ label: "B", marks: 2 },
						],
					},
					booleanRubric: null,
					numericalRubric: null,
				}),
			).toMatchObject({ type: "ordinal", marks: { A: 4, B: 2 } });
		});
	});

	describe("numerical", () => {
		test("throws when numericalRubric row is missing (Rubric Subtype Invariant violation)", () => {
			expect(() =>
				toRubric({
					...base,
					id: "r1",
					type: "numerical",
					ordinalRubric: null,
					booleanRubric: null,
					numericalRubric: null,
				}),
			).toThrow();
		});
	});

	describe("boolean", () => {
		test("throws when booleanRubric row is missing (Rubric Subtype Invariant violation)", () => {
			expect(() =>
				toRubric({
					...base,
					id: "r1",
					type: "boolean",
					ordinalRubric: null,
					booleanRubric: null,
					numericalRubric: null,
				}),
			).toThrow();
		});
	});
});
