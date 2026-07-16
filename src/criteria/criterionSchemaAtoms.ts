import { z } from "zod";

// Shared zod leaves for criterion schemas. Kind folders and the rubric verticals
// build their per-kind editor/import schemas on these atoms so the small,
// honestly-shared field rules (id, non-empty text, numeric) stay in one place
// without coupling the editor and YAML-import boundaries to a common shape
// (ADR 0013: share atomic leaves, not a cross-boundary schema base).

// Editor-boundary atoms.
export const editorIdSchema = z.string().trim().min(1, "Id is required");
export const editorPreviousIdSchema = editorIdSchema.optional();

// Import (YAML decode) boundary atoms.
export const importNonEmptyString = z.string().trim().min(1);
export const importNumericValue = z.number();

// Turns Zod's terse "Unrecognized key" error into an actionable message.
function unrecognizedKeysMessage(subject: string, keys: string[]): string {
	const names = keys.map((key) => `"${key}"`).join(", ");
	const plural = keys.length > 1;
	return `Unexpected ${plural ? "fields" : "field"} ${names} in ${subject}. Remove ${plural ? "them" : "it"} or fix the spelling, then import again.`;
}

export const baseImportCriterionSchema = z.object(
	{
		id: importNonEmptyString,
		description: importNonEmptyString.optional(),
		label: importNonEmptyString.optional(),
		kind: z.string(),
	},
	{
		// `.extend()`/`.strict()` preserve this error map, so every criterion kind inherits it.
		error: (issue) => {
			if (issue.code !== "unrecognized_keys") {
				return undefined;
			}
			const id = issue.input?.["id"];
			const subject =
				typeof id === "string" && id.length > 0
					? `criterion "${id}"`
					: "this criterion";
			return unrecognizedKeysMessage(subject, issue.keys);
		},
	},
);
