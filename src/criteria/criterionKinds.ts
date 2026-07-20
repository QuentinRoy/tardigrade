import { createCheckCriterion } from "./check/checkDomain.ts";
import { createNumberCriterion } from "./number/numberDomain.ts";
import { createOptionsCriterion } from "./options/optionsDomain.ts";
import type { CriterionDefinitionInput, CriterionKind } from "./types.ts";

// The union-keyed kind map (ADR 0013): client-safe factories only. No
// cross-tier references bundled here — grade-persistence's
// `subtypeTableByKind` stays separate, beside its only consumer — and no
// label strings; labels stay behind getCriterionKindLabel.
const criterionFactoryByKind = {
	check: createCheckCriterion,
	options: createOptionsCriterion,
	number: createNumberCriterion,
} as const satisfies Record<CriterionKind, () => CriterionDefinitionInput>;

// Spelled out (rather than derived via Object.keys(), which widens to
// string[]) so no assertion is needed. `satisfies` still checks every entry
// is a valid CriterionKind; exhaustiveness comes from the adjacent map's
// `satisfies Record<CriterionKind, ...>` above — adding a kind to the DB enum
// breaks that map's compile, which forces an edit right next to this array.
export const CRITERION_KINDS = [
	"check",
	"options",
	"number",
] as const satisfies readonly CriterionKind[];

export function isCriterionKind(value: string): value is CriterionKind {
	return Object.hasOwn(criterionFactoryByKind, value);
}

export function createCriterion(kind: CriterionKind): CriterionDefinitionInput {
	return criterionFactoryByKind[kind]();
}
