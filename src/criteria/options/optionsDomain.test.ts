import { describe, expect, it } from "vitest";
import type {
	OptionsCriterion,
	OptionsCriterionGradeContent,
} from "./optionsDomain.ts";
import {
	createOptionsCriterion,
	describeOptions,
	encodeOptionsCriterion,
	exportOptionsGradeValue,
	getOptionsCriterionMaxMarks,
	getOptionsCriterionMinMarks,
	isSameOptionsGrade,
	markOptionsCriterion,
	parseOptionsGradeValue,
	toOptionsCriterionDefinitionInput,
} from "./optionsDomain.ts";

function optionsCriterion(
	overrides: Partial<OptionsCriterion> = {},
): OptionsCriterion {
	return {
		id: "r1",
		kind: "options",
		marks: { Good: 2, Fair: 1, Poor: 0 },
		...overrides,
	};
}

function gradedOptionsCriterion(
	grade: OptionsCriterionGradeContent,
	overrides: Partial<OptionsCriterion> = {},
) {
	return { ...optionsCriterion(overrides), grade };
}

describe("markOptionsCriterion", () => {
	it("returns the marks the selected label carries", () => {
		expect(
			markOptionsCriterion(gradedOptionsCriterion({ selectedLabel: "Fair" })),
		).toBe(1);
	});

	it("returns negative marks as authored", () => {
		expect(
			markOptionsCriterion(
				gradedOptionsCriterion(
					{ selectedLabel: "Penalty" },
					{ marks: { Pass: 1, Penalty: -3 } },
				),
			),
		).toBe(-3);
	});

	it("throws when the selected label is not among the criterion's marks", () => {
		expect(() =>
			markOptionsCriterion(
				gradedOptionsCriterion({ selectedLabel: "Missing" }),
			),
		).toThrow('Selected label "Missing" not found in criterion marks');
	});
});

describe("options criterion marks bounds", () => {
	it("reports the authored min and max when they straddle 0", () => {
		const criterion = optionsCriterion({ marks: { Good: 3, Bad: -2 } });
		expect(getOptionsCriterionMaxMarks(criterion)).toBe(3);
		expect(getOptionsCriterionMinMarks(criterion)).toBe(-2);
	});

	// An ungraded criterion scores 0 (`markCriterion` returns 0 for a null grade),
	// so 0 participates in the range even when no label offers it.
	it("keeps 0 as the min when every label is positive", () => {
		const criterion = optionsCriterion({ marks: { Good: 4, Poor: 1 } });
		expect(getOptionsCriterionMaxMarks(criterion)).toBe(4);
		expect(getOptionsCriterionMinMarks(criterion)).toBe(0);
	});

	it("keeps 0 as the max when every label is negative", () => {
		const criterion = optionsCriterion({ marks: { Bad: -1, Worse: -4 } });
		expect(getOptionsCriterionMaxMarks(criterion)).toBe(0);
		expect(getOptionsCriterionMinMarks(criterion)).toBe(-4);
	});
});

describe("createOptionsCriterion", () => {
	it("seeds a new criterion with two labels, satisfying the marks minimum", () => {
		expect(createOptionsCriterion()).toEqual({
			id: "",
			kind: "options",
			label: "",
			description: "",
			marks: { Pass: 1, Fail: 0 },
		});
	});
});

describe("describeOptions", () => {
	it("projects the marks as neutral label/marks display facts", () => {
		expect(describeOptions(optionsCriterion())).toEqual({
			kind: "options",
			marksByLabel: [
				{ label: "Good", marks: 2 },
				{ label: "Fair", marks: 1 },
				{ label: "Poor", marks: 0 },
			],
		});
	});
});

describe("exportOptionsGradeValue", () => {
	it("projects the selected label as the CSV cell value", () => {
		expect(exportOptionsGradeValue({ selectedLabel: "Fair" })).toBe("Fair");
	});
});

describe("parseOptionsGradeValue", () => {
	it("accepts a label the criterion offers", () => {
		expect(
			parseOptionsGradeValue("Fair", { id: "r1", labels: ["Good", "Fair"] }),
		).toEqual({ selectedLabel: "Fair" });
	});

	it("rejects a label the criterion does not offer", () => {
		expect(() =>
			parseOptionsGradeValue("Great", { id: "r1", labels: ["Good", "Fair"] }),
		).toThrow('Invalid option label "Great" for criterion r1');
	});

	it("skips the membership check when the offered labels are unknown", () => {
		expect(parseOptionsGradeValue("Great", { id: "r1", labels: [] })).toEqual({
			selectedLabel: "Great",
		});
	});
});

describe("isSameOptionsGrade", () => {
	it("compares the selected label", () => {
		expect(
			isSameOptionsGrade({ selectedLabel: "Fair" }, { selectedLabel: "Fair" }),
		).toBe(true);
		expect(
			isSameOptionsGrade({ selectedLabel: "Fair" }, { selectedLabel: "Good" }),
		).toBe(false);
	});
});

describe("toOptionsCriterionDefinitionInput", () => {
	it("keeps the stored id as previousId", () => {
		expect(
			toOptionsCriterionDefinitionInput(optionsCriterion({ label: "Quality" })),
		).toEqual({
			previousId: "r1",
			id: "r1",
			description: undefined,
			label: "Quality",
			kind: "options",
			marks: { Good: 2, Fair: 1, Poor: 0 },
		});
	});
});

describe("encodeOptionsCriterion", () => {
	it("emits the marks and omits absent optional text", () => {
		expect(encodeOptionsCriterion(optionsCriterion())).toEqual({
			id: "r1",
			kind: "options",
			marks: { Good: 2, Fair: 1, Poor: 0 },
		});
	});

	it("includes label and description when present", () => {
		expect(
			encodeOptionsCriterion(
				optionsCriterion({ label: "Quality", description: "How good" }),
			),
		).toEqual({
			id: "r1",
			kind: "options",
			marks: { Good: 2, Fair: 1, Poor: 0 },
			label: "Quality",
			description: "How good",
		});
	});
});
