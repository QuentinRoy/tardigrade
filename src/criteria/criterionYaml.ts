import { assertNever } from "#utils/utils.ts";
import { encodeCheckCriterion } from "./check/checkDomain.ts";
import type { Criterion } from "./types.ts";

// Exhaustive YAML-encode dispatch (ADR 0013). `export` composes this downward so
// the in-process `Criterion` shape cannot silently move the YAML format. The
// `check` branch delegates to its folder; `options`/`number` pass through
// unchanged until their folders land in PR2/PR3.
export function encodeCriterion(criterion: Criterion): Record<string, unknown> {
	switch (criterion.kind) {
		case "check":
			return encodeCheckCriterion(criterion);
		case "options":
		case "number":
			return criterion;
		default:
			return assertNever(criterion);
	}
}
