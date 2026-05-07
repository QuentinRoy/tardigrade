import { promises as fs } from "fs";
import path from "path";

const STUDENTS_FILE_PATH = path.join(process.cwd(), "data", "students.csv");

type CsvRow = {
  family_name: string;
  first_name: string;
  id: string;
  team: string;
};

export type Paper = {
  id: string;
  label: string;
  team?: string;
};

function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const [headerLine, ...rowLines] = lines;
  const headers = headerLine.split(",");

  return rowLines.map((rowLine) => {
    const values = rowLine.split(",");
    const row = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    ) as CsvRow;

    return row;
  });
}

export default async function loadPapers(): Promise<Paper[]> {
  const csvContent = await fs.readFile(STUDENTS_FILE_PATH, "utf8");
  const rows = parseCsv(csvContent);

  const groupedByTeam = new Map<string, CsvRow[]>();

  rows.forEach((row) => {
    const team = row.team.trim();
    const key = team.length > 0 ? `team:${team}` : `student:${row.id}`;
    const currentRows = groupedByTeam.get(key) ?? [];
    currentRows.push(row);
    groupedByTeam.set(key, currentRows);
  });

  const usedIds = new Set<string>();

  return Array.from(groupedByTeam.entries()).map(([key, groupedRows]) => {
    const firstRow = groupedRows[0];
    const team = firstRow.team.trim();

    if (team.length > 0) {
      let id = `team-${toSlug(team) || "unknown"}`;
      let suffix = 1;
      while (usedIds.has(id)) {
        suffix += 1;
        id = `team-${toSlug(team) || "unknown"}-${suffix}`;
      }
      usedIds.add(id);

      return {
        id,
        label: `Team ${team}`,
        team,
      };
    }

    const label = `${firstRow.family_name} ${firstRow.first_name}`.trim();
    let id = `paper-${toSlug(firstRow.id) || "unknown"}`;
    let suffix = 1;
    while (usedIds.has(id)) {
      suffix += 1;
      id = `paper-${toSlug(firstRow.id) || "unknown"}-${suffix}`;
    }
    usedIds.add(id);

    return {
      id,
      label: label.length > 0 ? label : firstRow.id,
    };
  });
}
