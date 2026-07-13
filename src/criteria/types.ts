import type { CriterionKind } from "#db/generated/public/CriterionKind.ts";
import type { Simplify } from "#utils/utils.ts";

export type { CriterionKind };

type CriterionGradeBase = { criterionId: string; kind: CriterionKind };
export type CriterionGrade =
	| Simplify<CriterionGradeBase & { kind: "check"; passed: boolean }>
	| Simplify<CriterionGradeBase & { kind: "options"; selectedLabel: string }>
	| Simplify<CriterionGradeBase & { kind: "number"; score: number }>;

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

export type GradedCriterion<TKind extends CriterionKind = CriterionKind> =
	TKind extends CriterionKind
		? CriterionForKind<TKind> & {
				grade: CriterionGradeContentForKind<TKind> | null;
			}
		: never;

type CriterionGradeContentForKind<TKind extends CriterionKind> = Omit<
	CriterionGradeForKind<TKind>,
	"criterionId" | "kind"
>;

type CriterionGradeForKind<TKind extends CriterionKind> = Extract<
	CriterionGrade,
	{ kind: TKind }
>;
