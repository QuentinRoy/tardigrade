import type { Simplify } from "#utils/utils.ts";
import type { RubricType, SubmissionType } from "./generated/db.ts";

// Policy: keep schema-correlated types in this file derived from generated DB
// types to prevent drift, while exposing only curated app-facing contracts (no
// broad generated table-shape re-export from here).
export type { RubricType, SubmissionType };

type ProgressMetric = { completed: number; total: number };

export type GlobalAssessmentProgress = {
	submissions: ProgressMetric;
	questions: ProgressMetric;
	rubrics: ProgressMetric;
};

type SubmissionBase = { id: string; type: SubmissionType };

type SubmissionDisplay = {
	displayLabel?: string | undefined;
	memberNames?: string[] | undefined;
	searchKeys?: string[] | undefined;
};

export type Submission =
	| Simplify<
			SubmissionDisplay &
				SubmissionBase & {
					type: "individual";
					studentName: string;
					teamName?: undefined;
				}
	  >
	| Simplify<
			SubmissionDisplay &
				SubmissionBase & {
					type: "team";
					studentName?: undefined;
					teamName: string;
				}
	  >;

export type SubmissionSubmitter =
	| Simplify<
			SubmissionBase & {
				type: "individual";
				studentId: string;
				teamName?: undefined;
			}
	  >
	| Simplify<
			SubmissionBase & { type: "team"; studentId?: undefined; teamName: string }
	  >;

type RubricBase = {
	id: string;
	description?: string | undefined;
	label?: string | undefined;
	type: RubricType;
};

export type Rubric =
	| Simplify<
			RubricBase & { type: "boolean"; marks: number; falseMarks: number }
	  >
	| Simplify<RubricBase & { type: "ordinal"; marks: Record<string, number> }>
	| Simplify<
			RubricBase & {
				type: "numerical";
				minScore: number;
				maxScore: number;
				minMarks: number;
				maxMarks: number;
				reversed: boolean;
			}
	  >;

type AssessmentRubricValueBase = { rubricId: string; type: RubricType };
export type AssessmentRubricValue =
	| Simplify<AssessmentRubricValueBase & { type: "boolean"; passed: boolean }>
	| Simplify<
			AssessmentRubricValueBase & { type: "ordinal"; selectedLabel: string }
	  >
	| Simplify<AssessmentRubricValueBase & { type: "numerical"; score: number }>;

export type Question = { label?: string | undefined; rubrics: Rubric[] };

export type Grid = { [id: string]: Question };

// A Question plus the definition-level metadata an author edits in the
// management UI (see CONTEXT.md: "Question Definition").
export type QuestionDefinition = {
	id: string;
	position: number;
	assessmentCount: number;
	question: Question;
};
