import type { CriterionKind } from "#db/generated/public/CriterionKind.ts";
import type { Simplify } from "#utils/utils.ts";
import type {
	CheckCriterion,
	CheckCriterionGrade,
} from "./check/checkDomain.ts";
import type {
	NumberCriterion,
	NumberCriterionGrade,
} from "./number/numberDomain.ts";

export type { CriterionKind };

// The `Criterion`/`CriterionGrade` unions are assembled from each kind's content.
// The `check` and `number` members come from their folders; `options` is still
// inline here until PR3 stands up its folder (ADR 0013).

type CriterionGradeBase = { criterionId: string; kind: CriterionKind };
export type CriterionGrade =
	| CheckCriterionGrade
	| Simplify<CriterionGradeBase & { kind: "options"; selectedLabel: string }>
	| NumberCriterionGrade;

type CriterionBase = {
	id: string;
	description?: string | undefined;
	label?: string | undefined;
	kind: CriterionKind;
};

export type Criterion =
	| CheckCriterion
	| Simplify<CriterionBase & { kind: "options"; marks: Record<string, number> }>
	| NumberCriterion;

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
