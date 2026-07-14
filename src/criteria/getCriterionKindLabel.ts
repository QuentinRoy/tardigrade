import type { CriterionKind } from "./types.ts";

const CRITERION_KIND_LABELS: Record<CriterionKind, string> = {
	check: "Check",
	options: "Options",
	number: "Number",
};

export function getCriterionKindLabel(kind: CriterionKind): string {
	return CRITERION_KIND_LABELS[kind];
}
