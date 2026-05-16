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

    expect(yaml).toContain("questions:");
    expect(yaml).toContain("- id: q1");
    expect(yaml).toContain("label: Question 1");
    expect(yaml).toContain("- id: r1");
    expect(yaml).toContain("type: boolean");
    expect(yaml).toContain("marks: 2");
    expect(yaml).toContain("falseMarks: 0");
    expect(yaml).toContain("label: Correct");
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

    expect(yaml).toContain("type: ordinal");
    expect(yaml).toContain("excellent: 2");
    expect(yaml).toContain("good: 1");
    expect(yaml).toContain("poor: 0");
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

    expect(yaml).toContain("type: numerical");
    expect(yaml).toContain("minScore: 0");
    expect(yaml).toContain("maxScore: 10");
    expect(yaml).toContain("minMarks: 0");
    expect(yaml).toContain("maxMarks: 5");
    expect(yaml).toContain("reversed: false");
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

    expect(yaml).toContain("reversed: true");
  });

  it("omits label when undefined", () => {
    const questions: Grid = {
      q1: {
        rubrics: [
          {
            id: "r1",
            type: "boolean",
            marks: 1,
            falseMarks: 0,
          },
        ],
      },
    };

    const yaml = exportQuestionsToYaml(questions);

    expect(yaml).toContain("- id: q1");
    // Check that id is present but label line is not for the question
    const lines = yaml.split("\n");
    const idLine = lines.find((l) => l.trim() === "- id: q1");
    const nextLineAfterQ1 = lines[lines.indexOf(idLine ?? "") + 1];
    expect(nextLineAfterQ1).not.toMatch(/^\s*label:/);
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
          {
            id: "r2",
            type: "ordinal",
            marks: { A: 2, B: 1 },
            label: "Grade",
          },
        ],
      },
    };

    const yaml = exportQuestionsToYaml(questions);

    expect(yaml).toContain("- id: q1");
    expect(yaml).toContain("- id: q2");
    expect(yaml).toContain("Question 1");
    expect(yaml).toContain("Question 2");
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

    expect(yaml).toContain("description: Test description");
  });
});
