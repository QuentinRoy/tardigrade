import type { Rubric } from "@/db/types";
import { assertNever } from "../utils/utils";

export function getRubricMaxMarks(rubric: Rubric): number {
  switch (rubric.type) {
    case "boolean": {
      return rubric.marks;
    }
    case "ordinal": {
      const scores = Object.values(rubric.marks);
      return scores.length > 0 ? Math.max(0, ...scores) : 0;
    }
    case "numerical": {
      return rubric.maxMarks;
    }
    default: {
      return assertNever(rubric);
    }
  }
}

export function scoreToMarks(
  rubric: Extract<Rubric, { type: "numerical" }>,
  score: number,
): number {
  const scoreRange = rubric.maxScore - rubric.minScore;
  if (scoreRange <= 0) {
    return rubric.minMarks;
  }

  return (
    rubric.minMarks +
    ((score - rubric.minScore) * (rubric.maxMarks - rubric.minMarks)) /
      scoreRange
  );
}
