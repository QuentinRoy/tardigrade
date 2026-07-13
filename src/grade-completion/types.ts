import type { CompletionMetric } from "./gradeCompletion.ts";

export type GradeCompletionSummary = {
	gradeTargets: CompletionMetric;
	rubrics: CompletionMetric;
	criteria: CompletionMetric;
};
