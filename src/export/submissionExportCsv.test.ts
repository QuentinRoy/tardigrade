import { describe, expect, it } from "vitest";
import type { SubmissionSubmitter } from "@/db/types";
import {
  buildSubmissionExportHeaders,
  buildSubmissionExportRecord,
} from "./submissionExportCsv";

describe("submission CSV ordering", () => {
  const questions = [
    {
      id: "q1",
      rubrics: [
        {
          id: "r1",
          type: "boolean" as const,
          marks: 2,
          falseMarks: -1,
        },
        {
          id: "r2",
          type: "ordinal" as const,
          marks: { A: 3, B: 1 },
        },
      ],
    },
    {
      id: "q2",
      rubrics: [
        {
          id: "r3",
          type: "numerical" as const,
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
          reversed: false,
        },
      ],
    },
  ];

  const fullyAssessedQuestions = [
    {
      questionId: "q1",
      rubrics: [
        {
          rubricId: "r1",
          assessment: true,
          marks: 2,
        },
        {
          rubricId: "r2",
          assessment: "B",
          marks: 1,
        },
      ],
    },
    {
      questionId: "q2",
      rubrics: [
        {
          rubricId: "r3",
          assessment: 8,
          marks: 4,
        },
      ],
    },
  ];

  const failedBooleanQuestions = [
    {
      questionId: "q1",
      rubrics: [
        {
          rubricId: "r1",
          assessment: false,
          marks: -1,
        },
        {
          rubricId: "r2",
        },
      ],
    },
    {
      questionId: "q2",
      rubrics: [
        {
          rubricId: "r3",
        },
      ],
    },
  ];

  const unassessedQuestions = [
    {
      questionId: "q1",
      rubrics: [
        {
          rubricId: "r1",
        },
        {
          rubricId: "r2",
        },
      ],
    },
    {
      questionId: "q2",
      rubrics: [
        {
          rubricId: "r3",
        },
      ],
    },
  ];

  it("builds headers in rubric-before-question-total order", () => {
    const headers = buildSubmissionExportHeaders(questions, {
      includeRubricAssessment: true,
      includeRubricMarks: true,
    });

    expect(headers).toEqual([
      "submission_type",
      "submitter",
      "q1:r1",
      "q1:r1:marks",
      "q1:r2",
      "q1:r2:marks",
      "q1",
      "q2:r3",
      "q2:r3:marks",
      "q2",
      "grand_total_marks",
    ]);
  });

  it("builds sparse record values with question totals and grand total", () => {
    const row = buildSubmissionExportRecord({
      row: {
        submission: {
          id: "sub-1",
          type: "individual",
          studentId: "stu-123",
        },
        questions: fullyAssessedQuestions,
      },
      options: {
        includeRubricAssessment: true,
        includeRubricMarks: true,
      },
    });

    expect(row).toMatchInlineSnapshot(`
      {
        "grand_total_marks": 7,
        "q1": 3,
        "q1:r1": true,
        "q1:r1:marks": 2,
        "q1:r2": "B",
        "q1:r2:marks": 1,
        "q2": 4,
        "q2:r3": 8,
        "q2:r3:marks": 4,
        "submission_type": "individual",
        "submitter": "stu-123",
      }
    `);
  });

  it("uses falseMarks when a boolean rubric is not passed", () => {
    const row = buildSubmissionExportRecord({
      row: {
        submission: {
          id: "sub-1",
          type: "individual",
          studentId: "stu-123",
        },
        questions: failedBooleanQuestions,
      },
      options: {
        includeRubricAssessment: true,
        includeRubricMarks: true,
      },
    });

    expect(row).toMatchInlineSnapshot(`
      {
        "q1:r1": false,
        "q1:r1:marks": -1,
        "submission_type": "individual",
        "submitter": "stu-123",
      }
    `);
  });

  it("throws when submission type invariant is broken", () => {
    expect(() =>
      buildSubmissionExportRecord({
        row: {
          submission: {
            id: "sub-team",
            type: "team",
            teamName: "",
          },
          questions: unassessedQuestions,
        },
        options: {
          includeRubricAssessment: false,
          includeRubricMarks: false,
        },
      }),
    ).toThrow("Submission sub-team has type team but no team is linked.");
  });

  it("uses team name as submitter for team submissions", () => {
    const row = buildSubmissionExportRecord({
      row: {
        submission: {
          id: "sub-team-1",
          type: "team",
          teamName: "Team A",
        },
        questions: unassessedQuestions,
      },
      options: {
        includeRubricAssessment: true,
        includeRubricMarks: false,
      },
    });

    expect(row).toMatchInlineSnapshot(`
      {
        "submission_type": "team",
        "submitter": "Team A",
      }
    `);
  });

  it("requires student id for individual submissions at the type level", () => {
    type IndividualSubmitter = Extract<
      SubmissionSubmitter,
      { type: "individual" }
    >;

    // @ts-expect-error missing studentId for individual submission
    const _invalidIndividualSubmitter: IndividualSubmitter = {
      id: "sub-ind-1",
      type: "individual",
    };
  });
});
