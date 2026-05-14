import { describe, expect, it } from "vitest";
import { markBooleanRubric, markNumericalRubric } from "./rubric";

describe("scoreToMarks", () => {
  it("maps low scores to low marks by default", () => {
    expect(
      markNumericalRubric(
        {
          id: "r1",
          type: "numerical",
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
        },
        2,
      ),
    ).toBe(1);
  });

  it("reverses the mapping when requested", () => {
    expect(
      markNumericalRubric(
        {
          id: "r1",
          type: "numerical",
          minScore: 0,
          maxScore: 10,
          minMarks: 0,
          maxMarks: 5,
          reversed: true,
        },
        2,
      ),
    ).toBe(4);
  });
});

describe("booleanToMarks", () => {
  it("returns marks when passed", () => {
    expect(
      markBooleanRubric(
        {
          id: "r1",
          type: "boolean",
          marks: 2,
          falseMarks: -1,
        },
        true,
      ),
    ).toBe(2);
  });

  it("returns falseMarks when not passed", () => {
    expect(
      markBooleanRubric(
        {
          id: "r1",
          type: "boolean",
          marks: 2,
          falseMarks: -1,
        },
        false,
      ),
    ).toBe(-1);
  });
});
