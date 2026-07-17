import type { CriterionKind } from "#db/generated/public/CriterionKind.ts";
import type {
	CheckCriterion,
	CheckCriterionGrade,
} from "./check/checkDomain.ts";
import type {
	NumberCriterion,
	NumberCriterionGrade,
} from "./number/numberDomain.ts";
import type {
	OptionsCriterion,
	OptionsCriterionGrade,
} from "./options/optionsDomain.ts";

export type { CriterionKind };

// The `Criterion`/`CriterionGrade` unions are assembled from each kind's content,
// every member sourced from its own kind folder (ADR 0013).

export type CriterionGrade =
	| CheckCriterionGrade
	| OptionsCriterionGrade
	| NumberCriterionGrade;

export type Criterion = CheckCriterion | OptionsCriterion | NumberCriterion;

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
