import type { CompletionMetric } from "./assessmentCompletion.ts";

export type AssessmentCompletionSummary = {
	gradeTargets: CompletionMetric;
	rubrics: CompletionMetric;
	criteria: CompletionMetric;
};
