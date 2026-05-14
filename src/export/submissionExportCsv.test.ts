import { describe, expect, it } from "vitest";
import type { SubmissionSubmitter } from "@/db/types";
import {
  buildSubmissionExportHeaders,
  buildSubmissionExportRow,
  type ExportAssessedQuestionPlan,
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
        {
          id: "r1",
          label: "R1",
          type: "boolean" as const,
          marks: 2,
          falseMarks: -1,
        },
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
          reversed: false,
        },
      ],
    },
  ];

  const fullyAssessedQuestions: ExportAssessedQuestionPlan[] = [
    {
      id: "q1",
      label: "Q1",
      rubrics: [
        {
          id: "r1",
          label: "R1",
          type: "boolean",
          marks: 2,
          falseMarks: -1,
          assessment: { passed: true },
        },
        {
          id: "r2",
          label: "R2",
          type: "ordinal",
          marks: { A: 3, B: 1 },
          assessment: { selectedLabel: "B" },
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
          type: "numerical",
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
          reversed: false,
          assessment: { score: 8 },
        },
      ],
    },
  ];

  const failedBooleanQuestions: ExportAssessedQuestionPlan[] = [
    {
      id: "q1",
      label: "Q1",
      rubrics: [
        {
          id: "r1",
          label: "R1",
          type: "boolean",
          marks: 2,
          falseMarks: -1,
          assessment: { passed: false },
        },
        {
          id: "r2",
          label: "R2",
          type: "ordinal",
          marks: { A: 3, B: 1 },
          assessment: null,
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
          type: "numerical",
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
          reversed: false,
          assessment: null,
        },
      ],
    },
  ];

  const unassessedQuestions: ExportAssessedQuestionPlan[] = [
    {
      id: "q1",
      label: "Q1",
      rubrics: [
        {
          id: "r1",
          label: "R1",
          type: "boolean",
          marks: 2,
          falseMarks: -1,
          assessment: null,
        },
        {
          id: "r2",
          label: "R2",
          type: "ordinal",
          marks: { A: 3, B: 1 },
          assessment: null,
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
          type: "numerical",
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
          reversed: false,
          assessment: null,
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
    const row = buildSubmissionExportRow({
      submission: {
        id: "sub-1",
        type: "individual",
        studentId: "stu-123",
      },
      questions: fullyAssessedQuestions,
      options: {
        includeRubricAssessment: true,
        includeRubricMarks: true,
      },
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

  it("uses falseMarks when a boolean rubric is not passed", () => {
    const row = buildSubmissionExportRow({
      submission: {
        id: "sub-1",
        type: "individual",
        studentId: "stu-123",
      },
      questions: failedBooleanQuestions,
      options: {
        includeRubricAssessment: true,
        includeRubricMarks: true,
      },
    });

    expect(row).toEqual([
      "individual",
      "stu-123",
      "false",
      "-1",
      "",
      "",
      "-1",
      "",
      "",
      "0",
      "-1",
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
        questions: unassessedQuestions,
        options: {
          includeRubricAssessment: false,
          includeRubricMarks: false,
        },
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
      questions: unassessedQuestions,
      options: {
        includeRubricAssessment: false,
        includeRubricMarks: false,
      },
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
