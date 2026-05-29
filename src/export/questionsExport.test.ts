import { describe, expect, it } from "vitest";
import type { Grid } from "@/db/types";
import { exportQuestionsToYaml } from "./questionsExport";

describe("exportQuestionsToYaml", () => {
	it("exports a boolean rubric question", () => {
		const questions: Grid = {
			q1: {
				label: "Question 1",
				rubrics: [
					{
						id: "r1",
						type: "boolean",
						marks: 2,
						falseMarks: 0,
						label: "Correct",
						description: undefined,
					},
				],
			},
		};

		const yaml = exportQuestionsToYaml(questions);

		expect(yaml).toMatchInlineSnapshot(`
      "questions:
        - id: q1
          label: Question 1
          rubrics:
            - id: r1
              type: boolean
              marks: 2
              falseMarks: 0
              label: Correct
      "
    `);
	});

	it("exports an ordinal rubric question", () => {
		const questions: Grid = {
			q1: {
				label: "Question 1",
				rubrics: [
					{
						id: "r1",
						type: "ordinal",
						marks: { excellent: 2, good: 1, poor: 0 },
						label: "Style",
						description: undefined,
					},
				],
			},
		};

		const yaml = exportQuestionsToYaml(questions);
		expect(yaml).toMatchInlineSnapshot(`
      "questions:
        - id: q1
          label: Question 1
          rubrics:
            - id: r1
              type: ordinal
              marks:
                excellent: 2
                good: 1
                poor: 0
              label: Style
      "
    `);
	});

	it("exports a numerical rubric question", () => {
		const questions: Grid = {
			q1: {
				label: "Question 1",
				rubrics: [
					{
						id: "r1",
						type: "numerical",
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

		const yaml = exportQuestionsToYaml(questions);
		expect(yaml).toMatchInlineSnapshot(`
      "questions:
        - id: q1
          label: Question 1
          rubrics:
            - id: r1
              type: numerical
              minScore: 0
              maxScore: 10
              minMarks: 0
              maxMarks: 5
              reversed: false
              label: Score
      "
    `);
	});

	it("exports a numerical rubric with reversed true", () => {
		const questions: Grid = {
			q1: {
				rubrics: [
					{
						id: "r1",
						type: "numerical",
						minScore: 0,
						maxScore: 10,
						minMarks: 0,
						maxMarks: 5,
						reversed: true,
					},
				],
			},
		};

		const yaml = exportQuestionsToYaml(questions);
		expect(yaml).toMatchInlineSnapshot(`
      "questions:
        - id: q1
          rubrics:
            - id: r1
              type: numerical
              minScore: 0
              maxScore: 10
              minMarks: 0
              maxMarks: 5
              reversed: true
      "
    `);
	});

	it("omits label when undefined", () => {
		const questions: Grid = {
			q1: { rubrics: [{ id: "r1", type: "boolean", marks: 1, falseMarks: 0 }] },
		};

		const yaml = exportQuestionsToYaml(questions);

		expect(yaml).toMatchInlineSnapshot(`
      "questions:
        - id: q1
          rubrics:
            - id: r1
              type: boolean
              marks: 1
              falseMarks: 0
      "
    `);
	});

	it("exports multiple questions", () => {
		const questions: Grid = {
			q1: {
				label: "Question 1",
				rubrics: [
					{
						id: "r1",
						type: "boolean",
						marks: 1,
						falseMarks: 0,
						label: "Correct",
					},
				],
			},
			q2: {
				label: "Question 2",
				rubrics: [
					{ id: "r2", type: "ordinal", marks: { A: 2, B: 1 }, label: "Grade" },
				],
			},
		};

		const yaml = exportQuestionsToYaml(questions);
		expect(yaml).toMatchInlineSnapshot(`
      "questions:
        - id: q1
          label: Question 1
          rubrics:
            - id: r1
              type: boolean
              marks: 1
              falseMarks: 0
              label: Correct
        - id: q2
          label: Question 2
          rubrics:
            - id: r2
              type: ordinal
              marks:
                A: 2
                B: 1
              label: Grade
      "
    `);
	});

	it("omits description when undefined", () => {
		const questions: Grid = {
			q1: {
				rubrics: [
					{
						id: "r1",
						type: "boolean",
						marks: 1,
						falseMarks: 0,
						description: "Test description",
					},
				],
			},
		};

		const yaml = exportQuestionsToYaml(questions);
		expect(yaml).toMatchInlineSnapshot(`
      "questions:
        - id: q1
          rubrics:
            - id: r1
              type: boolean
              marks: 1
              falseMarks: 0
              description: Test description
      "
    `);
	});
});
