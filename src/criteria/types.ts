import type { Simplify } from "#utils/utils.ts";

export type CriterionKind = "check" | "number" | "options";

type AssessmentCriterionValueBase = {
	criterionId: string;
	kind: CriterionKind;
};
export type AssessmentCriterionValue =
	| Simplify<AssessmentCriterionValueBase & { kind: "check"; passed: boolean }>
	| Simplify<
			AssessmentCriterionValueBase & { kind: "options"; selectedLabel: string }
	  >
	| Simplify<AssessmentCriterionValueBase & { kind: "number"; score: number }>;

type CriterionBase = {
	id: string;
	description?: string | undefined;
	label?: string | undefined;
	kind: CriterionKind;
};

export type Criterion =
	| Simplify<
			CriterionBase & { kind: "check"; marks: number; falseMarks: number }
	  >
	| Simplify<CriterionBase & { kind: "options"; marks: Record<string, number> }>
	| Simplify<
			CriterionBase & {
				kind: "number";
				minScore: number;
				maxScore: number;
				minMarks: number;
				maxMarks: number;
				reversed: boolean;
			}
	  >;

export type CriterionForKind<TKind extends CriterionKind> = Extract<
	Criterion,
	{ kind: TKind }
>;

export type AssessedCriterion<TKind extends CriterionKind = CriterionKind> =
	TKind extends CriterionKind
		? CriterionForKind<TKind> & {
				assessment: AssessmentValueForCriterionKind<TKind> | null;
			}
		: never;

type AssessmentValueForCriterionKind<TKind extends CriterionKind> = Omit<
	AssessmentForCriterionKind<TKind>,
	"criterionId" | "kind"
>;

type AssessmentForCriterionKind<TKind extends CriterionKind> = Extract<
	AssessmentCriterionValue,
	{ kind: TKind }
>;
