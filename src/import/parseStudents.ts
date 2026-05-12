import { parse as parseCSV } from "csv-parse/sync";
import { toSlug } from "./saveUtils";
import { studentRowsSchema } from "./schemas";
import type { ImportedStudent, ImportedSubmission } from "./types";

export function parseStudentsCsv(content: string): ImportedStudent[] {
  const rows = parseCSV(content, {
    columns: true,
    skip_empty_lines: true,
  });

  return studentRowsSchema.parse(rows);
}

export function groupStudentsIntoSubmissions(
  students: ImportedStudent[],
): ImportedSubmission[] {
  const groupedByPaper = new Map<string, ImportedStudent[]>();

  for (const student of students) {
    const key =
      student.team == null ? `student:${student.id}` : `team:${student.team}`;
    const currentStudents = groupedByPaper.get(key) ?? [];
    currentStudents.push(student);
    groupedByPaper.set(key, currentStudents);
  }

  const usedIds = new Set<string>();

  return Array.from(groupedByPaper.values(), (groupedStudents) => {
    const firstStudent = groupedStudents[0];

    if (firstStudent.team != null) {
      let id = `team-${toSlug(firstStudent.team) || "unknown"}`;
      let suffix = 1;
      while (usedIds.has(id)) {
        suffix += 1;
        id = `team-${toSlug(firstStudent.team) || "unknown"}-${suffix}`;
      }
      usedIds.add(id);

      return {
        id,
        type: "TEAM",
        team: firstStudent.team,
        students: groupedStudents,
      };
    }

    let id = `submission-${toSlug(firstStudent.id) || "unknown"}`;
    let suffix = 1;
    while (usedIds.has(id)) {
      suffix += 1;
      id = `submission-${toSlug(firstStudent.id) || "unknown"}-${suffix}`;
    }
    usedIds.add(id);

    return {
      id,
      type: "INDIVIDUAL",
      students: groupedStudents,
    };
  });
}
