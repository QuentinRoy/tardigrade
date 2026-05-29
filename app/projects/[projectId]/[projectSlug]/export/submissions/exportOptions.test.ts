import { describe, expect, it } from "vitest";
import { parseExportOptions } from "./exportOptions";

describe("parseExportOptions", () => {
	it("parses repeated include params", () => {
		const options = parseExportOptions(
			new URLSearchParams(
				"include=rubric-assessment&include=rubric-marks&include=rubric-assessment",
			),
		);

		expect(options).toEqual({
			includeRubricAssessment: true,
			includeRubricMarks: true,
		});
	});

	it("throws on invalid include", () => {
		expect(() =>
			parseExportOptions(new URLSearchParams("include=foo")),
		).toThrow("Invalid include option: foo");
	});
});
