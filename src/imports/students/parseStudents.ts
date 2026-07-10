import { parse as parseCSV } from "csv-parse/sync";
import { toSlug } from "#imports/saveUtils.ts";
import { studentRowsSchema } from "#imports/schemas.ts";
import type {
	ImportedStudent,
	NormalizedImportedSubmission,
} from "#imports/types.ts";
import type { NonEmptyArray } from "#utils/utils.ts";

export function parseStudentsCsv(content: string): ImportedStudent[] {
	const rows = parseCSV(content, { columns: true, skip_empty_lines: true });

	return studentRowsSchema.parse(rows);
}

export function groupStudentsIntoSubmissions(
	students: ImportedStudent[],
): NormalizedImportedSubmission[] {
	const groupedByPaper = new Map<string, NonEmptyArray<ImportedStudent>>();

	for (const student of students) {
		const key =
			student.group == null
				? `student:${student.id}`
				: `group:${student.group}`;
		let currentStudents = groupedByPaper.get(key);
		if (currentStudents == null) {
			currentStudents = [student];
		} else {
			currentStudents.push(student);
		}
		groupedByPaper.set(key, currentStudents);
	}

	const usedIds = new Set<string>();

	return Array.from(groupedByPaper.values(), (groupedStudents) => {
		const firstStudent = groupedStudents[0];

		if (firstStudent.group != null) {
			let id = `group-${toSlug(firstStudent.group) || "unknown"}`;
			let suffix = 1;
			while (usedIds.has(id)) {
				suffix += 1;
				id = `group-${toSlug(firstStudent.group) || "unknown"}-${suffix}`;
			}
			usedIds.add(id);

			return {
				id,
				type: "group",
				group: firstStudent.group,
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

		return { id, type: "individual", students: groupedStudents };
	});
}
