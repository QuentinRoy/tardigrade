import { describe, expect, it } from "vitest";
import type { AssessmentRubricValue, SubmissionSubmitter } from "@/db/types";
import {
  buildSubmissionExportHeaders,
  buildSubmissionExportRow,
  getSubmissionExportIdentifier,
  parseExportOptions,
} from "./submissionExportCsv";

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

describe("submission CSV ordering", () => {
  const questions = [
    {
      id: "q1",
      label: "Q1",
      rubrics: [
        { id: "r1", label: "R1", type: "boolean" as const, marks: 2 },
        {
          id: "r2",
          label: "R2",
          type: "ordinal" as const,
          marks: { A: 3, B: 1 },
        },
      ],
    },
    {
      id: "q2",
      label: "Q2",
      rubrics: [
        {
          id: "r3",
          label: "R3",
          type: "numerical" as const,
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
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

  it("builds row values with question totals and grand total", () => {
    const valuesByKey = new Map<string, AssessmentRubricValue>([
      [
        "q1::r1",
        {
          rubricId: "r1",
          type: "boolean" as const,
          passed: true,
        },
      ],
      [
        "q1::r2",
        {
          rubricId: "r2",
          type: "ordinal" as const,
          selectedLabel: "B",
        },
      ],
      [
        "q2::r3",
        {
          rubricId: "r3",
          type: "numerical" as const,
          score: 8,
        },
      ],
    ]);

    const row = buildSubmissionExportRow({
      submission: {
        id: "sub-1",
        type: "individual",
        studentId: "stu-123",
      },
      questions,
      options: {
        includeRubricAssessment: true,
        includeRubricMarks: true,
      },
      valuesByKey,
    });

    expect(row).toEqual([
      "individual",
      "stu-123",
      "true",
      "2",
      "B",
      "1",
      "3",
      "8",
      "4",
      "4",
      "7",
    ]);
  });

  it("throws when submission type invariant is broken", () => {
    expect(() =>
      buildSubmissionExportRow({
        submission: {
          id: "sub-team",
          type: "team",
          teamName: "",
        },
        questions,
        options: {
          includeRubricAssessment: false,
          includeRubricMarks: false,
        },
        valuesByKey: new Map(),
      }),
    ).toThrow("Submission sub-team has type team but no team is linked.");
  });

  it("uses team name as submitter for team submissions", () => {
    const row = buildSubmissionExportRow({
      submission: {
        id: "sub-team-1",
        type: "team",
        teamName: "Team A",
      },
      questions,
      options: {
        includeRubricAssessment: false,
        includeRubricMarks: false,
      },
      valuesByKey: new Map(),
    });

    expect(row[0]).toBe("team");
    expect(row[1]).toBe("Team A");
  });

  it("requires student id for individual submissions at the type level", () => {
    type IndividualSubmitter = Extract<
      SubmissionSubmitter,
      { type: "individual" }
    >;

    // @ts-expect-error missing studentId for individual submission
    const invalidIndividualSubmitter: IndividualSubmitter = {
      id: "sub-ind-1",
      type: "individual",
    };

    expect(invalidIndividualSubmitter).toBeDefined();
  });
});
