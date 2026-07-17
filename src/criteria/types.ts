import type { CriterionKind } from "#db/generated/public/CriterionKind.ts";
import type {
	CheckCriterion,
	CheckCriterionGrade,
} from "./check/checkDomain.ts";
import type { CheckCriterionDefinitionInput } from "./check/checkSchemas.ts";
import type {
	NumberCriterion,
	NumberCriterionGrade,
} from "./number/numberDomain.ts";
import type { NumberCriterionDefinitionInput } from "./number/numberSchemas.ts";
import type {
	OptionsCriterion,
	OptionsCriterionGrade,
} from "./options/optionsDomain.ts";
import type { OptionsCriterionDefinitionInput } from "./options/optionsSchemas.ts";

export type { CriterionKind };

// The authored/configured representation of a Criterion, as edited by an
// author (CONTEXT.md: Criterion Definition) — the Derived Input Type for the
// three per-kind editor schemas' `z.output` (ADR 0013).
export type CriterionDefinitionInput =
	| CheckCriterionDefinitionInput
	| OptionsCriterionDefinitionInput
	| NumberCriterionDefinitionInput;

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
