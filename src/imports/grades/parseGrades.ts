import { parse as parseCSV } from "csv-parse/sync";
import { gradeRowsSchema } from "#imports/schemas.ts";
import type { ImportedGradeRow } from "#imports/types.ts";

export async function parseGradesCsv(
	content: string,
): Promise<ImportedGradeRow[]> {
	const rows = parseCSV(content, { columns: true, skip_empty_lines: true });

	return gradeRowsSchema.parse(rows);
}
