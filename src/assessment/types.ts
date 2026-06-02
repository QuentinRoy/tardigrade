import type { RubricType } from "#rubrics/types.ts";
import type { Simplify } from "#utils/utils.ts";

type ProgressMetric = { completed: number; total: number };

export type GlobalAssessmentProgress = {
	submissions: ProgressMetric;
	questions: ProgressMetric;
	rubrics: ProgressMetric;
};

type AssessmentRubricValueBase = { rubricId: string; type: RubricType };
export type AssessmentRubricValue =
	| Simplify<AssessmentRubricValueBase & { type: "boolean"; passed: boolean }>
	| Simplify<
			AssessmentRubricValueBase & { type: "ordinal"; selectedLabel: string }
	  >
	| Simplify<AssessmentRubricValueBase & { type: "numerical"; score: number }>;
