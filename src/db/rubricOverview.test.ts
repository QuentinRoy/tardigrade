import { describe, expect, it } from "vitest";
import {
  buildRubricOverviewData,
  type RubricOverviewAssessmentRecord,
} from "./rubricOverviewBuilder";
import type { Grid, Submission } from "./types";

describe("buildRubricOverviewData", () => {
  const submissions: Submission[] = [
    {
      id: "1",
      type: "individual",
      studentName: "Alice A",
      displayLabel: "Alice A",
      memberNames: [],
      searchKeys: ["alice a"],
    },
    {
      id: "2",
      type: "individual",
      studentName: "Bob B",
      displayLabel: "Bob B",
      memberNames: [],
      searchKeys: ["bob b"],
    },
  ];

  const questionGrid: Grid = {
    q1: {
      label: "Question 1",
      rubrics: [
        {
          id: "r-boolean",
          type: "boolean",
          marks: 2,
          falseMarks: 0,
          label: "Correct",
          description: "Correct answer",
        },
      ],
    },
    q2: {
      label: "Question 2",
      rubrics: [
        {
          id: "r-numerical",
          type: "numerical",
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
          reversed: false,
          label: "Quality",
          description: "Quality from 0 to 10",
        },
      ],
    },
  };

  it("preserves authored rubric order", () => {
    const data = buildRubricOverviewData({
      submissions,
      questionGrid,
      assessmentRecords: [],
    });

    expect(data.rubrics.map((rubric) => rubric.rubricId)).toEqual([
      "r-boolean",
      "r-numerical",
    ]);
  });

  it("computes averages and completion for mixed rubric types", () => {
    const records: RubricOverviewAssessmentRecord[] = [
      {
        submissionId: 1,
        rubricId: "r-boolean",
        type: "boolean",
        passed: true,
        selectedLabel: null,
        score: null,
      },
      {
        submissionId: 2,
        rubricId: "r-boolean",
        type: "boolean",
        passed: false,
        selectedLabel: null,
        score: null,
      },
      {
        submissionId: 1,
        rubricId: "r-numerical",
        type: "numerical",
        passed: null,
        selectedLabel: null,
        score: 8,
      },
    ];

    const data = buildRubricOverviewData({
      submissions,
      questionGrid,
      assessmentRecords: records,
    });

    const booleanRubric = data.rubrics.find(
      (row) => row.rubricId === "r-boolean",
    );
    const numericalRubric = data.rubrics.find(
      (row) => row.rubricId === "r-numerical",
    );

    expect(booleanRubric).toMatchObject({
      assessedCount: 2,
      totalCount: 2,
      completionPercent: 100,
      averageMarks: 1,
      averagePercent: 50,
    });

    expect(numericalRubric).toMatchObject({
      assessedCount: 1,
      totalCount: 2,
      completionPercent: 50,
      averageMarks: 4,
      averagePercent: 80,
    });
  });

  it("maps popup details with type-specific properties", () => {
    const data = buildRubricOverviewData({
      submissions,
      questionGrid,
      assessmentRecords: [],
    });

    expect(data.rubrics[0]?.details).toEqual({
      label: "Correct",
      description: "Correct answer",
      type: "boolean",
      properties: {
        type: "boolean",
        trueMarks: 2,
        falseMarks: 0,
      },
    });

    expect(data.rubrics[1]?.details).toEqual({
      label: "Quality",
      description: "Quality from 0 to 10",
      type: "numerical",
      properties: {
        type: "numerical",
        minScore: 0,
        maxScore: 10,
        minMarks: 0,
        maxMarks: 5,
        reversed: false,
      },
    });
  });
});
