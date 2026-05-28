import type { ExportOptions } from "@/export/submissionExportCsv";

export function parseExportOptions(
  searchParams: URLSearchParams,
): ExportOptions {
  const includes = searchParams.getAll("include");

  const includeSet = new Set<"rubric-assessment" | "rubric-marks">();
  for (const include of includes) {
    if (include === "rubric-assessment" || include === "rubric-marks") {
      includeSet.add(include);
      continue;
    }

    throw new Error(`Invalid include option: ${include}`);
  }

  return {
    includeRubricAssessment: includeSet.has("rubric-assessment"),
    includeRubricMarks: includeSet.has("rubric-marks"),
  };
}
