import type { RubricType } from "#rubrics/types.ts";
import type { Simplify } from "#utils/utils.ts";
import type { CompletionMetric } from "./assessmentCompletion.ts";

export type AssessmentCompletionSummary = {
	submissions: CompletionMetric;
	questions: CompletionMetric;
	rubrics: CompletionMetric;
};

type AssessmentRubricValueBase = { rubricId: string; type: RubricType };
export type AssessmentRubricValue =
	| Simplify<AssessmentRubricValueBase & { type: "boolean"; passed: boolean }>
	| Simplify<
			AssessmentRubricValueBase & { type: "ordinal"; selectedLabel: string }
	  >
	| Simplify<AssessmentRubricValueBase & { type: "numerical"; score: number }>;
