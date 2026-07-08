import type { CompletionMetric } from "./assessmentCompletion.ts";

export type AssessmentCompletionSummary = {
	submissions: CompletionMetric;
	questions: CompletionMetric;
	criteria: CompletionMetric;
};
