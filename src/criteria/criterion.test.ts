import { describe, expect, it } from "vitest";
import { attachGrade, hasSameGrade } from "./criterion.ts";
import type { Criterion, CriterionGrade, GradedCriterion } from "./types.ts";

const checkCriterion: GradedCriterion = {
	id: "c1",
	kind: "check",
	marks: 1,
	falseMarks: 0,
	grade: { passed: true },
};

// One matching and one differing grade per kind, so the generic dispatcher is
// exercised once for every branch of its switch and a misrouted kind fails.
const gradeCasesByKind: Array<{
	criterion: GradedCriterion;
	sameGrade: CriterionGrade;
	otherGrade: CriterionGrade;
}> = [
	{
		criterion: checkCriterion,
		sameGrade: { criterionId: "c1", kind: "check", passed: true },
		otherGrade: { criterionId: "c1", kind: "check", passed: false },
	},
	{
		criterion: {
			id: "c1",
			kind: "options",
			marks: { Pass: 1, Fail: 0 },
			grade: { selectedLabel: "Pass" },
		},
		sameGrade: { criterionId: "c1", kind: "options", selectedLabel: "Pass" },
		otherGrade: { criterionId: "c1", kind: "options", selectedLabel: "Fail" },
	},
	{
		criterion: {
			id: "c1",
			kind: "number",
			minValue: 0,
			maxValue: 10,
			minMarks: 0,
			maxMarks: 10,
			reversed: false,
			grade: { value: 4 },
		},
		sameGrade: { criterionId: "c1", kind: "number", value: 4 },
		otherGrade: { criterionId: "c1", kind: "number", value: 5 },
	},
];

describe.each(
	gradeCasesByKind,
)("hasSameGrade for a $criterion.kind criterion", ({
	criterion,
	sameGrade,
	otherGrade,
}) => {
	it("matches a grade holding the same content", () => {
		expect(hasSameGrade(criterion, sameGrade)).toBe(true);
	});

	it("does not match a grade holding different content", () => {
		expect(hasSameGrade(criterion, otherGrade)).toBe(false);
	});
});

describe("attachGrade", () => {
	const criterion: Criterion = {
		id: "c1",
		kind: "check",
		marks: 1,
		falseMarks: 0,
	};

	it("attaches the grade content, without the grade's identity fields", () => {
		expect(
			attachGrade(criterion, {
				criterionId: "c1",
				kind: "check",
				passed: true,
			}),
		).toEqual({ ...criterion, grade: { passed: true } });
	});

	it("picks the matching grade out of a list", () => {
		expect(
			attachGrade(criterion, [
				{ criterionId: "c2", kind: "check", passed: false },
				{ criterionId: "c1", kind: "check", passed: true },
			]),
		).toEqual({ ...criterion, grade: { passed: true } });
	});

	it("attaches no grade when the source holds none for the criterion", () => {
		expect(
			attachGrade(criterion, {
				criterionId: "c2",
				kind: "check",
				passed: true,
			}),
		).toEqual({ ...criterion, grade: null });
	});

	it("throws when the stored grade is of another kind", () => {
		expect(() =>
			attachGrade(criterion, { criterionId: "c1", kind: "number", value: 1 }),
		).toThrow(
			"Grade for criterion c1 is of kind number, but the criterion is of kind check",
		);
	});

	it("attaches no grade when there is no source", () => {
		expect(attachGrade(criterion, undefined)).toEqual({
			...criterion,
			grade: null,
		});
	});
});

describe("hasSameGrade", () => {
	it("does not match an ungraded criterion", () => {
		expect(
			hasSameGrade(
				{ ...checkCriterion, grade: null },
				{ criterionId: "c1", kind: "check", passed: true },
			),
		).toBe(false);
	});

	it("does not match a grade for another criterion", () => {
		expect(
			hasSameGrade(checkCriterion, {
				criterionId: "c2",
				kind: "check",
				passed: true,
			}),
		).toBe(false);
	});

	it("does not match a grade of another kind", () => {
		expect(
			hasSameGrade(checkCriterion, {
				criterionId: "c1",
				kind: "number",
				value: 1,
			}),
		).toBe(false);
	});
});
