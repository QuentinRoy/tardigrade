// The Number Criterion Bounds invariant (CONTEXT.md): a Criterion Definition must
// satisfy `minValue < maxValue` and `minMarks <= maxMarks`. This is the single
// owner of the rule; the editor schema, import schema, and grade-save validation
// all consume it, so the rule matches at every write boundary while each keeps
// its own user-facing message (ADR 0013).
//
// `markNumberCriterion` deliberately does NOT consume these — it tolerates an
// inverted range and guards only the zero-width case that would otherwise yield
// `NaN`. Kept dependency-free so both the (zod) schema leaf and the (server-only)
// grade-save path can import it without pulling in either.

export function isNumberValueRangeValid({
	minValue,
	maxValue,
}: {
	minValue: number;
	maxValue: number;
}): boolean {
	return minValue < maxValue;
}

export function isNumberMarksRangeValid({
	minMarks,
	maxMarks,
}: {
	minMarks: number;
	maxMarks: number;
}): boolean {
	return minMarks <= maxMarks;
}
