import { describe, expect, it } from "vitest";
import type { CheckCriterion } from "./checkDomain.ts";
import {
	describeCheck,
	encodeCheckCriterion,
	exportCheckGradeValue,
	getCheckCriterionMaxMarks,
	getCheckCriterionMinMarks,
	isSameCheckGrade,
	markCheckCriterion,
	parseCheckGradeValue,
	toCheckCriterionDefinitionInput,
} from "./checkDomain.ts";

function checkCriterion(
	overrides: Partial<CheckCriterion> = {},
): CheckCriterion {
	return { id: "r1", kind: "check", marks: 2, falseMarks: -1, ...overrides };
}

describe("markCheckCriterion", () => {
	it("returns marks when passed", () => {
		expect(markCheckCriterion(checkCriterion(), { passed: true })).toBe(2);
	});

	it("returns falseMarks when not passed", () => {
		expect(markCheckCriterion(checkCriterion(), { passed: false })).toBe(-1);
	});
});

describe("check criterion marks bounds", () => {
	it("reports the larger of marks and falseMarks as the max", () => {
		expect(getCheckCriterionMaxMarks(checkCriterion())).toBe(2);
		expect(
			getCheckCriterionMaxMarks(checkCriterion({ marks: -3, falseMarks: 1 })),
		).toBe(1);
	});

	it("reports the smaller of marks and falseMarks as the min", () => {
		expect(getCheckCriterionMinMarks(checkCriterion())).toBe(-1);
		expect(
			getCheckCriterionMinMarks(checkCriterion({ marks: -3, falseMarks: 1 })),
		).toBe(-3);
	});
});

describe("describeCheck", () => {
	it("projects true/false marks as neutral display facts", () => {
		expect(describeCheck(checkCriterion())).toEqual({
			kind: "check",
			trueMarks: 2,
			falseMarks: -1,
		});
	});
});

describe("exportCheckGradeValue", () => {
	it("projects the passed flag as the CSV cell value", () => {
		expect(exportCheckGradeValue({ passed: true })).toBe(true);
		expect(exportCheckGradeValue({ passed: false })).toBe(false);
	});
});

describe("parseCheckGradeValue", () => {
	it("accepts true/false in any case", () => {
		expect(parseCheckGradeValue("TRUE")).toEqual({ passed: true });
		expect(parseCheckGradeValue("false")).toEqual({ passed: false });
	});

	it("rejects a cell that is not a check value", () => {
		expect(() => parseCheckGradeValue("yes")).toThrow(
			'Invalid check value "yes"',
		);
	});
});

describe("isSameCheckGrade", () => {
	it("compares the passed flag", () => {
		expect(isSameCheckGrade({ passed: true }, { passed: true })).toBe(true);
		expect(isSameCheckGrade({ passed: true }, { passed: false })).toBe(false);
	});
});

describe("toCheckCriterionDefinitionInput", () => {
	it("keeps the stored id as previousId", () => {
		expect(
			toCheckCriterionDefinitionInput(checkCriterion({ label: "Correct" })),
		).toEqual({
			previousId: "r1",
			id: "r1",
			description: undefined,
			label: "Correct",
			kind: "check",
			marks: 2,
			falseMarks: -1,
		});
	});
});

describe("encodeCheckCriterion", () => {
	it("emits marks/falseMarks and omits absent optional text", () => {
		expect(
			encodeCheckCriterion(checkCriterion({ marks: 1, falseMarks: 0 })),
		).toEqual({ id: "r1", kind: "check", marks: 1, falseMarks: 0 });
	});

	it("includes label and description when present", () => {
		expect(
			encodeCheckCriterion(
				checkCriterion({ label: "Correct", description: "Answer is right" }),
			),
		).toEqual({
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: -1,
			label: "Correct",
			description: "Answer is right",
		});
	});
});
