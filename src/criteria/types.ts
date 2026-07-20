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

export type CriterionGrade<TKind extends CriterionKind = CriterionKind> =
	Extract<
		CheckCriterionGrade | OptionsCriterionGrade | NumberCriterionGrade,
		{ kind: TKind }
	>;

export type Criterion = CheckCriterion | OptionsCriterion | NumberCriterion;

export type CriterionForKind<TKind extends CriterionKind> = Extract<
	Criterion,
	{ kind: TKind }
>;

// Result of validating a grade against its criterion's current definition
// (ADR 0013 pinned adapter signature). Each kind's `validate*GradeInDb`
// returns this instead of a bare `string | undefined`, so the failure message
// can't be mistaken for a success value.
export type GradeValidationResult =
	| { valid: true }
	| { valid: false; message: string };

// Built as a union first, then selected with Extract (rather than as a
// distributive conditional). Both spell the same types, but a conditional stays
// unresolved while its type argument is still generic, which forces callers
// holding a `GradedCriterion<TKind>` to widen before they can read `.grade` or
// dispatch on `.kind`.
type GradedCriterionUnion = {
	[TKind in CriterionKind]: CriterionForKind<TKind> & {
		grade: CriterionGradeContentForKind<TKind> | null;
	};
}[CriterionKind];

export type GradedCriterion<TKind extends CriterionKind = CriterionKind> =
	Extract<GradedCriterionUnion, { kind: TKind }>;

// A graded criterion known to carry a grade, as produced by `hasGrade`.
export type MarkedCriterion<TKind extends CriterionKind = CriterionKind> =
	GradedCriterion<TKind> & {
		grade: NonNullable<GradedCriterion<TKind>["grade"]>;
	};

export type CriterionGradeContentForKind<TKind extends CriterionKind> = Omit<
	CriterionGrade<TKind>,
	"criterionId" | "kind"
>;
