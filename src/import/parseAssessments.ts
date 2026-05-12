import { parse as parseCSV } from "csv-parse/sync";

export async function parseAssessmentsCsv(
  content: string,
): Promise<Array<Record<string, string>>> {
  const rows = parseCSV(content, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  return rows;
}
