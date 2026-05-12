import { describe, expect, it } from "vitest";
import type { AssessmentRubricValue } from "@/db/types";
import {
  buildSubmissionExportHeaders,
  buildSubmissionExportRow,
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
    ).toThrowError("Invalid include option: foo");
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
          marksByLabel: { A: 3, B: 1 },
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
      "submissionId",
      "submissionType",
      "submitter",
      "q1:r1 assessment",
      "q1:r1 marks",
      "q1:r2 assessment",
      "q1:r2 marks",
      "q1",
      "q2:r3 assessment",
      "q2:r3 marks",
      "q2",
      "grand total marks",
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
        type: "INDIVIDUAL",
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
      "sub-1",
      "INDIVIDUAL",
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
          type: "TEAM",
          teamName: "",
        },
        questions,
        options: {
          includeRubricAssessment: false,
          includeRubricMarks: false,
        },
        valuesByKey: new Map(),
      }),
    ).toThrowError("Submission sub-team has type TEAM but no team is linked.");
  });
});
