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

// Object.keys() widens key types to string[]; criterionFactoryByKind's
// `satisfies Record<CriterionKind, ...>` above guarantees these are exactly
// the CriterionKind members, in declaration order.
// biome-ignore lint/plugin/no-type-assertion: Object.keys() cannot express it.
export const CRITERION_KINDS = Object.keys(
	criterionFactoryByKind,
) as CriterionKind[];

export function isCriterionKind(value: string): value is CriterionKind {
	return Object.hasOwn(criterionFactoryByKind, value);
}

export function createCriterion(kind: CriterionKind): CriterionDefinitionInput {
	return criterionFactoryByKind[kind]();
}
