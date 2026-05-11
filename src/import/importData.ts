import { parse as parseCSV } from "csv-parse/sync";
import yaml from "js-yaml";
import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const numericValue = z.coerce.number();

const baseRubricSchema = z.object({
  id: nonEmptyString,
  description: nonEmptyString.optional(),
  label: nonEmptyString.optional(),
  type: z.string(),
});

const booleanRubricSchema = baseRubricSchema.extend({
  type: z.literal("boolean"),
  marks: numericValue.nonnegative(),
});

const ordinalValuesSchema = z
  .record(nonEmptyString, numericValue.nonnegative())
  .refine((values) => Object.keys(values).length >= 2, {
    message: "Ordinal rubric must have at least 2 values",
  });

const ordinalRubricSchema = baseRubricSchema.extend({
  type: z.literal("ordinal"),
  values: ordinalValuesSchema,
});

const numericalRubricSchema = baseRubricSchema
  .extend({
    type: z.literal("numerical"),
    min: numericValue,
    max: numericValue,
  })
  .refine((r) => r.min < r.max, {
    message: "min must be less than max",
  });

const rubricSchema = z.discriminatedUnion("type", [
  booleanRubricSchema,
  ordinalRubricSchema,
  numericalRubricSchema,
]);

const questionSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString.optional(),
  rubrics: z
    .array(rubricSchema)
    .refine(
      (rubrics) => new Set(rubrics.map((r) => r.id)).size === rubrics.length,
      { message: "Rubric ids must be unique within a question" },
    ),
});

const questionsSchema = z.object({
  questions: z
    .array(questionSchema)
    .refine(
      (questions) =>
        new Set(questions.map((q) => q.id)).size === questions.length,
      { message: "Question ids must be unique" },
    ),
});

const studentRowSchema = z
  .object({
    family_name: nonEmptyString,
    first_name: nonEmptyString,
    id: nonEmptyString,
    team: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
  })
  .transform((row) => ({
    familyName: row.family_name,
    firstName: row.first_name,
    id: row.id,
    ...("team" in row && row.team != null ? { team: row.team } : {}),
  }));

const studentRowsSchema = z.array(studentRowSchema);

export type ImportedRubric = z.output<typeof rubricSchema>;
export type ImportedQuestion = z.output<typeof questionSchema>;
export type ImportedQuestions = z.output<typeof questionsSchema>["questions"];
export type ImportedStudent = z.output<typeof studentRowSchema>;
export type ImportedPaper = {
  id: string;
  label: string;
  team?: string;
  students: ImportedStudent[];
};

export function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function parseQuestionsYaml(content: string): ImportedQuestions {
  const parsed = yaml.load(content);
  return questionsSchema.parse(parsed).questions;
}

export function parseStudentsCsv(content: string): ImportedStudent[] {
  const rows = parseCSV(content, {
    columns: true,
    skip_empty_lines: true,
  });
  return studentRowsSchema.parse(rows);
}

export function buildPapersFromStudents(
  students: ImportedStudent[],
): ImportedPaper[] {
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
        label: `Team ${firstStudent.team}`,
        team: firstStudent.team,
        students: groupedStudents,
      };
    }

    let id = `paper-${toSlug(firstStudent.id) || "unknown"}`;
    let suffix = 1;
    while (usedIds.has(id)) {
      suffix += 1;
      id = `paper-${toSlug(firstStudent.id) || "unknown"}-${suffix}`;
    }
    usedIds.add(id);

    return {
      id,
      label: `${firstStudent.familyName} ${firstStudent.firstName}`.trim(),
      students: groupedStudents,
    };
  });
}
