import { describe, expect, it } from "vitest";
import { parseQuestionsYaml } from "./parseQuestions";
import {
  groupStudentsIntoSubmissions,
  parseStudentsCsv,
} from "./parseStudents";

describe("parseQuestionsYaml", () => {
  it("parses valid questions YAML", () => {
    const questions = parseQuestionsYaml(`questions:
  - id: q1
    label: Question 1
    rubrics:
      - id: r1
        type: boolean
        marks: 2`);

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("q1");
    expect(questions[0].rubrics[0].id).toBe("r1");
  });

  it("throws when question ids are duplicated", () => {
    expect(() =>
      parseQuestionsYaml(`questions:
  - id: q1
    rubrics:
      - id: r1
        type: boolean
        marks: 1
  - id: q1
    rubrics:
      - id: r2
        type: boolean
        marks: 1`),
    ).toThrow("Question ids must be unique");
  });
});

describe("parseStudentsCsv", () => {
  it("parses required columns and optional team", () => {
    const students = parseStudentsCsv(`family_name,first_name,id,team
Smith,Alice,s1,
Jones,Bob,s2,Team A`);

    expect(students).toEqual([
      {
        familyName: "Smith",
        firstName: "Alice",
        id: "s1",
      },
      {
        familyName: "Jones",
        firstName: "Bob",
        id: "s2",
        team: "Team A",
      },
    ]);
  });
});

describe("groupStudentsIntoSubmissions", () => {
  it("groups team students and creates individual submissions", () => {
    const students = [
      {
        familyName: "Smith",
        firstName: "Alice",
        id: "s1",
      },
      {
        familyName: "Jones",
        firstName: "Bob",
        id: "s2",
        team: "Team A",
      },
      {
        familyName: "Ray",
        firstName: "Cora",
        id: "s3",
        team: "Team A",
      },
    ];

    const submissions = groupStudentsIntoSubmissions(students);

    expect(submissions).toHaveLength(2);

    const teamSubmission = submissions.find(
      (submission) => submission.type === "TEAM",
    );
    expect(teamSubmission).toBeDefined();
    expect(teamSubmission?.students).toHaveLength(2);

    const individualSubmission = submissions.find(
      (submission) => submission.type === "INDIVIDUAL",
    );
    expect(individualSubmission).toBeDefined();
    expect(individualSubmission?.students[0].id).toBe("s1");
  });
});
