import type { CriterionKind } from "#db/generated/public/CriterionKind.ts";
import type { Simplify } from "#utils/utils.ts";
import type {
	CheckCriterion,
	CheckCriterionGrade,
} from "./check/checkDomain.ts";

export type { CriterionKind };

// The `Criterion`/`CriterionGrade` unions are assembled from each kind's content.
// The `check` members come from `criteria/check/`; `options`/`number` are still
// inline here until PR2/PR3 stand up their folders (ADR 0013).

type CriterionGradeBase = { criterionId: string; kind: CriterionKind };
export type CriterionGrade =
	| CheckCriterionGrade
	| Simplify<CriterionGradeBase & { kind: "options"; selectedLabel: string }>
	| Simplify<CriterionGradeBase & { kind: "number"; value: number }>;

type CriterionBase = {
	id: string;
	description?: string | undefined;
	label?: string | undefined;
	kind: CriterionKind;
};

export type Criterion =
	| CheckCriterion
	| Simplify<CriterionBase & { kind: "options"; marks: Record<string, number> }>
	| Simplify<
			CriterionBase & {
				kind: "number";
				minValue: number;
				maxValue: number;
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
