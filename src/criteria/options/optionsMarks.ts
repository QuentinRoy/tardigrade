// The Options Marks Minimum invariant (CONTEXT.md): an Options Criterion
// Definition must define at least two mark entries — an Options criterion is a
// choice between labels, and fewer than two is not an authorable state. This is
// the single owner of the rule; the editor schema and the import schema both
// consume it, so the rule matches at every write boundary (ADR 0013).
//
// Kept dependency-free, and out of optionsDomain.ts, so the (zod) schema leaves
// can import it without forming an optionsDomain ↔ optionsSchemas cycle.

export function hasEnoughOptionsMarks(marks: Record<string, number>): boolean {
	return Object.keys(marks).length >= 2;
}
