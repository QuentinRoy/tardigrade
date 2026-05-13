import type { AssessmentRubricValue, Rubric } from "@/db/types";
import { assertNever } from "../utils/utils";

type RubricType = Rubric["type"];
type RubricForType<TType extends RubricType> = Extract<Rubric, { type: TType }>;

type AssessmentForRubricType<TType extends RubricType> = Extract<
  AssessmentRubricValue,
  { type: TType }
>;

type AssessmentValueForRubricType<TType extends RubricType> = Omit<
  AssessmentForRubricType<TType>,
  "rubricId" | "type"
>;

export type AssessedRubric<TType extends RubricType = RubricType> =
  TType extends RubricType
    ? RubricForType<TType> & {
        assessment?: AssessmentValueForRubricType<TType>;
      }
    : never;

function findAssessment(
  rubricId: string,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessmentRubricValue | undefined {
  if (source == null) {
    return undefined;
  }

  if (!Array.isArray(source)) {
    if (source.rubricId !== rubricId) {
      return undefined;
    }

    return source;
  }

  return source.find((item) => item.rubricId === rubricId);
}

export function attachAssessment<TType extends RubricType>(
  rubric: RubricForType<TType>,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<TType> {
  const assessment = findAssessment(rubric.id, source);

  switch (rubric.type) {
    case "boolean": {
      return {
        ...rubric,
        assessment:
          assessment?.type === "boolean"
            ? { passed: assessment.passed }
            : undefined,
      } as AssessedRubric<TType>;
    }
    case "ordinal": {
      return {
        ...rubric,
        assessment:
          assessment?.type === "ordinal"
            ? { selectedLabel: assessment.selectedLabel }
            : undefined,
      } as AssessedRubric<TType>;
    }
    case "numerical": {
      return {
        ...rubric,
        assessment:
          assessment?.type === "numerical"
            ? { score: assessment.score }
            : undefined,
      } as AssessedRubric<TType>;
    }
    default: {
      return assertNever(rubric.type);
    }
  }
}
