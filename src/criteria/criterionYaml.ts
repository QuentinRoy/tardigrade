import { assertNever } from "#utils/utils.ts";
import { encodeCheckCriterion } from "./check/checkDomain.ts";
import { encodeNumberCriterion } from "./number/numberDomain.ts";
import type { Criterion } from "./types.ts";

// Exhaustive YAML-encode dispatch (ADR 0013). `export` composes this downward so
// the in-process `Criterion` shape cannot silently move the YAML format. The
// `check` and `number` branches delegate to their folders; `options` passes
// through unchanged until its folder lands in PR3.
export function encodeCriterion(criterion: Criterion): Record<string, unknown> {
	switch (criterion.kind) {
		case "check":
			return encodeCheckCriterion(criterion);
		case "number":
			return encodeNumberCriterion(criterion);
		case "options":
			return criterion;
		default:
			return assertNever(criterion);
	}
}
