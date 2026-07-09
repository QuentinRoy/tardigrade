import { describe, expect, it } from "vitest";
import type { RubricsById } from "#rubrics/types.ts";
import { exportRubricsToYaml } from "./rubricsExport.ts";

describe("exportRubricsToYaml", () => {
	it("exports a boolean criterion rubric", () => {
		const rubrics: RubricsById = {
			q1: {
				label: "Rubric 1",
				criteria: [
					{
						id: "r1",
						kind: "check",
						marks: 2,
						falseMarks: 0,
						label: "Correct",
						description: undefined,
					},
				],
			},
		};

		const yaml = exportRubricsToYaml(rubrics);

		expect(yaml).toMatchInlineSnapshot(`
      "rubrics:
        - id: q1
          label: Rubric 1
          criteria:
            - id: r1
              kind: check
              marks: 2
              falseMarks: 0
              label: Correct
      "
    `);
	});

	it("exports an ordinal criterion rubric", () => {
		const rubrics: RubricsById = {
			q1: {
				label: "Rubric 1",
				criteria: [
					{
						id: "r1",
						kind: "options",
						marks: { excellent: 2, good: 1, poor: 0 },
						label: "Style",
						description: undefined,
					},
				],
			},
		};

		const yaml = exportRubricsToYaml(rubrics);
		expect(yaml).toMatchInlineSnapshot(`
      "rubrics:
        - id: q1
          label: Rubric 1
          criteria:
            - id: r1
              kind: options
              marks:
                excellent: 2
                good: 1
                poor: 0
              label: Style
      "
    `);
	});

	it("exports a numerical criterion rubric", () => {
		const rubrics: RubricsById = {
			q1: {
				label: "Rubric 1",
				criteria: [
					{
						id: "r1",
						kind: "number",
						minScore: 0,
						maxScore: 10,
						minMarks: 0,
						maxMarks: 5,
						reversed: false,
						label: "Score",
						description: undefined,
					},
				],
			},
		};

		const yaml = exportRubricsToYaml(rubrics);
		expect(yaml).toMatchInlineSnapshot(`
      "rubrics:
        - id: q1
          label: Rubric 1
          criteria:
            - id: r1
              kind: number
              minScore: 0
              maxScore: 10
              minMarks: 0
              maxMarks: 5
              reversed: false
              label: Score
      "
    `);
	});

	it("exports a numerical criterion with reversed true", () => {
		const rubrics: RubricsById = {
			q1: {
				criteria: [
					{
						id: "r1",
						kind: "number",
						minScore: 0,
						maxScore: 10,
						minMarks: 0,
						maxMarks: 5,
						reversed: true,
					},
				],
			},
		};

		const yaml = exportRubricsToYaml(rubrics);
		expect(yaml).toMatchInlineSnapshot(`
      "rubrics:
        - id: q1
          criteria:
            - id: r1
              kind: number
              minScore: 0
              maxScore: 10
              minMarks: 0
              maxMarks: 5
              reversed: true
      "
    `);
	});

	it("omits label when undefined", () => {
		const rubrics: RubricsById = {
			q1: { criteria: [{ id: "r1", kind: "check", marks: 1, falseMarks: 0 }] },
		};

		const yaml = exportRubricsToYaml(rubrics);

		expect(yaml).toMatchInlineSnapshot(`
      "rubrics:
        - id: q1
          criteria:
            - id: r1
              kind: check
              marks: 1
              falseMarks: 0
      "
    `);
	});

	it("exports multiple rubrics", () => {
		const rubrics: RubricsById = {
			q1: {
				label: "Rubric 1",
				criteria: [
					{
						id: "r1",
						kind: "check",
						marks: 1,
						falseMarks: 0,
						label: "Correct",
					},
				],
			},
			q2: {
				label: "Rubric 2",
				criteria: [
					{ id: "r2", kind: "options", marks: { A: 2, B: 1 }, label: "Grade" },
				],
			},
		};

		const yaml = exportRubricsToYaml(rubrics);
		expect(yaml).toMatchInlineSnapshot(`
      "rubrics:
        - id: q1
          label: Rubric 1
          criteria:
            - id: r1
              kind: check
              marks: 1
              falseMarks: 0
              label: Correct
        - id: q2
          label: Rubric 2
          criteria:
            - id: r2
              kind: options
              marks:
                A: 2
                B: 1
              label: Grade
      "
    `);
	});

	it("omits description when undefined", () => {
		const rubrics: RubricsById = {
			q1: {
				criteria: [
					{
						id: "r1",
						kind: "check",
						marks: 1,
						falseMarks: 0,
						description: "Test description",
					},
				],
			},
		};

		const yaml = exportRubricsToYaml(rubrics);
		expect(yaml).toMatchInlineSnapshot(`
      "rubrics:
        - id: q1
          criteria:
            - id: r1
              kind: check
              marks: 1
              falseMarks: 0
              description: Test description
      "
    `);
	});
});
