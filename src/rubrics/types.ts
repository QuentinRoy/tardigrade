import type { Simplify } from "#utils/utils.ts";

export type RubricType = "boolean" | "numerical" | "ordinal";

type AssessmentRubricValueBase = { rubricId: string; type: RubricType };
export type AssessmentRubricValue =
	| Simplify<AssessmentRubricValueBase & { type: "boolean"; passed: boolean }>
	| Simplify<
			AssessmentRubricValueBase & { type: "ordinal"; selectedLabel: string }
	  >
	| Simplify<AssessmentRubricValueBase & { type: "numerical"; score: number }>;

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

export type RubricForType<TType extends RubricType> = Extract<
	Rubric,
	{ type: TType }
>;

export type AssessedRubric<TType extends RubricType = RubricType> =
	TType extends RubricType
		? RubricForType<TType> & {
				assessment: AssessmentValueForRubricType<TType> | null;
			}
		: never;

type AssessmentValueForRubricType<TType extends RubricType> = Omit<
	AssessmentForRubricType<TType>,
	"rubricId" | "type"
>;

type AssessmentForRubricType<TType extends RubricType> = Extract<
	AssessmentRubricValue,
	{ type: TType }
>;
