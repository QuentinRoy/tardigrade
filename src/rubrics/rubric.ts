import type { Rubric } from "@/db/types";

export function getRubricMaxMarks(rubric: Rubric): number {
  if (rubric.type === "boolean") {
    return rubric.marks;
  }

  if (rubric.type === "ordinal") {
    const scores = Object.values(rubric.marks);
    return scores.length > 0 ? Math.max(0, ...scores) : 0;
  }

  return rubric.maxMarks;
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
