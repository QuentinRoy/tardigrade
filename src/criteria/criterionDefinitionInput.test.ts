import { describe, expect, it } from "vitest";
import { toCriterionDefinitionInput } from "./criterionDefinitionInput.ts";
import type { Criterion, CriterionDefinitionInput } from "./types.ts";

// One criterion per kind, so the generic dispatcher is exercised once for every
// branch of its switch and a misrouted kind fails.
const criterionCasesByKind: Array<{
	criterion: Criterion;
	expected: CriterionDefinitionInput;
}> = [
	{
		criterion: {
			id: "c1",
			kind: "check",
			label: "Compiles",
			description: "The submission builds",
			marks: 1,
			falseMarks: 0,
		},
		expected: {
			previousId: "c1",
			id: "c1",
			kind: "check",
			label: "Compiles",
			description: "The submission builds",
			marks: 1,
			falseMarks: 0,
		},
	},
	{
		criterion: {
			id: "c2",
			kind: "options",
			label: "Style",
			description: "Coding style",
			marks: { Pass: 1, Fail: 0 },
		},
		expected: {
			previousId: "c2",
			id: "c2",
			kind: "options",
			label: "Style",
			description: "Coding style",
			marks: { Pass: 1, Fail: 0 },
		},
	},
	{
		criterion: {
			id: "c3",
			kind: "number",
			label: "Tests passing",
			description: "Share of passing tests",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		},
		expected: {
			previousId: "c3",
			id: "c3",
			kind: "number",
			label: "Tests passing",
			description: "Share of passing tests",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 5,
			reversed: false,
		},
	},
];

describe("toCriterionDefinitionInput", () => {
	it.each(criterionCasesByKind)(
		"projects a $criterion.kind criterion to its authored definition",
		({ criterion, expected }) => {
			expect(toCriterionDefinitionInput(criterion)).toEqual(expected);
		},
	);
});
