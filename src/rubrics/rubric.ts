export type Rubric =
  | {
      id: string;
      description?: string | undefined;
      label?: string | undefined;
      type: "boolean";
      marks: number;
    }
  | {
      id: string;
      description?: string | undefined;
      label?: string | undefined;
      type: "ordinal";
      marks: Record<string, number>;
    }
  | {
      id: string;
      description?: string | undefined;
      label?: string | undefined;
      type: "numerical";
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
    };

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
