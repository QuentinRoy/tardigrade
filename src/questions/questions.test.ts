import { describe, expect, test } from "vitest";
import type { QuestionRow } from "./questions.ts";
import { questionCacheTags, toQuestionGrid, toRubric } from "./questions.ts";

test("questionCacheTags declares the questions tag", () => {
	expect(questionCacheTags()).toEqual(["questions"]);
});

describe("toQuestionGrid", () => {
	const booleanRow: QuestionRow = {
		id: "q1",
		label: "Question 1",
		rubrics: [
			{
				id: "r1",
				type: "boolean",
				description: null,
				label: "Correct",
				booleanRubric: { marks: 2, falseMarks: 0 },
				ordinalRubric: null,
				numericalRubric: null,
			},
		],
	};

	test("returns empty object for no rows", () => {
		expect(toQuestionGrid([])).toEqual({});
	});

	test("uses question id as key", () => {
		const grid = toQuestionGrid([booleanRow]);
		expect(Object.keys(grid)).toEqual(["q1"]);
	});

	test("converts null label to undefined", () => {
		const row: QuestionRow = { id: "q2", label: null, rubrics: [] };
		expect(toQuestionGrid([row])["q2"]?.label).toBeUndefined();
	});

	test("preserves non-null label", () => {
		expect(toQuestionGrid([booleanRow])["q1"]?.label).toBe("Question 1");
	});

	test("converts rubric rows via toRubric", () => {
		const grid = toQuestionGrid([booleanRow]);
		expect(grid["q1"]?.rubrics).toHaveLength(1);
		expect(grid["q1"]?.rubrics[0]?.id).toBe("r1");
	});
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
