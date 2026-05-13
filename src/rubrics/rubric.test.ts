import { describe, expect, it } from "vitest";
import { scoreToMarks } from "./rubric";

describe("scoreToMarks", () => {
  it("maps low scores to low marks by default", () => {
    expect(
      scoreToMarks(
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
      scoreToMarks(
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
