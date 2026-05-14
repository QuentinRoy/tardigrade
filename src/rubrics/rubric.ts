import type { AssessmentRubricValue, Rubric } from "@/db/types";
import { assertNever, DistributedOmit } from "../utils/utils";

export function getRubricMaxMarks(rubric: Rubric): number {
  switch (rubric.type) {
    case "boolean": {
      return Math.max(rubric.marks, rubric.falseMarks ?? 0);
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

export function markNumericalRubric(
  rubric: Extract<Rubric, { type: "numerical" }>,
  score: number,
): number {
  const scoreRange = rubric.maxScore - rubric.minScore;
  if (scoreRange <= 0) {
    return rubric.minMarks;
  }

  const reversed = rubric.reversed ?? false;

  const scoreOffset = reversed
    ? rubric.maxScore - score
    : score - rubric.minScore;

  return (
    rubric.minMarks +
    (scoreOffset * (rubric.maxMarks - rubric.minMarks)) / scoreRange
  );
}

export function markBooleanRubric(
  rubric: Extract<Rubric, { type: "boolean" }>,
  passed: boolean,
): number {
  return passed ? rubric.marks : (rubric.falseMarks ?? 0);
}

export function markOrdinalRubric(
  rubric: Extract<Rubric, { type: "ordinal" }>,
  selectedLabel: string,
): number {
  if (!(selectedLabel in rubric.marks)) {
    throw new Error(
      `Selected label "${selectedLabel}" not found in rubric marks`,
    );
  }
  return rubric.marks[selectedLabel];
}

export function markRubric({
  rubric,
  value,
}: {
  rubric: Rubric;
  value: DistributedOmit<AssessmentRubricValue, "rubricId">;
}): number {
  switch (rubric.type) {
    case "boolean":
      if (value.type !== "boolean") {
        throw new Error(
          `Expected boolean assessment value for rubric ${rubric.id}, got ${value.type}`,
        );
      }
      return markBooleanRubric(rubric, value.passed);
    case "ordinal":
      if (value.type !== "ordinal") {
        throw new Error(
          `Expected ordinal assessment value for rubric ${rubric.id}, got ${value.type}`,
        );
      }
      return markOrdinalRubric(rubric, value.selectedLabel);
    case "numerical":
      if (value.type !== "numerical") {
        throw new Error(
          `Expected numerical assessment value for rubric ${rubric.id}, got ${value.type}`,
        );
      }
      return markNumericalRubric(rubric, value.score);
    default:
      assertNever(rubric);
  }
}
