import { describe, expect, test } from "vitest";
import type { RubricRow } from "./rubrics.ts";
import { rubricCacheTags, toCriterion, toRubricsById } from "./rubrics.ts";

test("rubricCacheTags declares the grid-scoped rubrics tag", () => {
	expect(rubricCacheTags({ gridId: "g-1" })).toEqual(["grids:g-1:rubrics"]);
});

describe("toRubricsById", () => {
	const booleanRow: RubricRow = {
		id: "q1",
		label: "Rubric 1",
		criteria: [
			{
				id: "r1",
				kind: "check",
				description: null,
				label: "Correct",
				checkCriterion: { marks: 2, falseMarks: 0 },
				optionsCriterion: null,
				numberCriterion: null,
			},
		],
	};

	test("returns empty object for no rows", () => {
		expect(toRubricsById([])).toEqual({});
	});

	test("uses rubric id as key", () => {
		const rubricsById = toRubricsById([booleanRow]);
		expect(Object.keys(rubricsById)).toEqual(["q1"]);
	});

	test("converts null label to undefined", () => {
		const row: RubricRow = { id: "q2", label: null, criteria: [] };
		expect(toRubricsById([row])["q2"]?.label).toBeUndefined();
	});

	test("preserves non-null label", () => {
		expect(toRubricsById([booleanRow])["q1"]?.label).toBe("Rubric 1");
	});

	test("converts criterion rows via toCriterion", () => {
		const rubricsById = toRubricsById([booleanRow]);
		expect(rubricsById["q1"]?.criteria).toHaveLength(1);
		expect(rubricsById["q1"]?.criteria[0]?.id).toBe("r1");
	});
});

describe("toCriterion", () => {
	const base = { description: null, label: null };

	describe("options", () => {
		test("throws when optionsCriterion row is missing (Criterion Subtype Invariant violation)", () => {
			expect(() =>
				toCriterion({
					...base,
					id: "r1",
					kind: "options",
					optionsCriterion: null,
					checkCriterion: null,
					numberCriterion: null,
				}),
			).toThrow();
		});

		test("maps to { kind: 'ordinal', marks: {} } when optionsCriterion row exists with zero values", () => {
			expect(
				toCriterion({
					...base,
					id: "r1",
					kind: "options",
					optionsCriterion: { marks: [] },
					checkCriterion: null,
					numberCriterion: null,
				}),
			).toMatchObject({ id: "r1", kind: "options", marks: {} });
		});

		test("maps marks correctly", () => {
			expect(
				toCriterion({
					...base,
					id: "r1",
					kind: "options",
					optionsCriterion: {
						marks: [
							{ label: "A", marks: 4 },
							{ label: "B", marks: 2 },
						],
					},
					checkCriterion: null,
					numberCriterion: null,
				}),
			).toMatchObject({ kind: "options", marks: { A: 4, B: 2 } });
		});
	});

	describe("number", () => {
		test("throws when numberCriterion row is missing (Criterion Subtype Invariant violation)", () => {
			expect(() =>
				toCriterion({
					...base,
					id: "r1",
					kind: "number",
					optionsCriterion: null,
					checkCriterion: null,
					numberCriterion: null,
				}),
			).toThrow();
		});
	});

	describe("check", () => {
		test("throws when checkCriterion row is missing (Criterion Subtype Invariant violation)", () => {
			expect(() =>
				toCriterion({
					...base,
					id: "r1",
					kind: "check",
					optionsCriterion: null,
					checkCriterion: null,
					numberCriterion: null,
				}),
			).toThrow();
		});
	});
});
