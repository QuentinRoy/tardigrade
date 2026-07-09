import type { CompletionMetric } from "./assessmentCompletion.ts";

export type AssessmentCompletionSummary = {
	submissions: CompletionMetric;
	rubrics: CompletionMetric;
	criteria: CompletionMetric;
};
