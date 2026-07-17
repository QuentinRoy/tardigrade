import type { CriterionKind } from "./types.ts";

// Identity today (kind values are already lowercase English words), but this
// is the i18n seam for criterion-kind display text — callers must go through
// it rather than rendering `criterion.kind` directly, so a future locale
// change has one place to land.
export function getCriterionKindLabel(kind: CriterionKind): string {
	return kind;
}
