import "server-only";
import { Prisma, RubricType, SubmissionType } from "@prisma/client";
import { parse as parseCSV } from "csv-parse/sync";
import yaml from "js-yaml";
import { z } from "zod";
import { prisma } from "../db/prisma";

const nonEmptyString = z.string().trim().min(1);
const numericValue = z.number();

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

const ordinalMarksSchema = z
  .record(nonEmptyString, numericValue.nonnegative())
  .refine((marks) => Object.keys(marks).length >= 2, {
    message: "Ordinal rubric must have at least 2 mark entries",
  });

const ordinalRubricSchema = baseRubricSchema.extend({
  type: z.literal("ordinal"),
  marks: ordinalMarksSchema,
});

const numericalRubricSchema = baseRubricSchema
  .extend({
    type: z.literal("numerical"),
    minScore: numericValue.optional(),
    maxScore: numericValue.optional(),
    minMarks: numericValue.optional(),
    maxMarks: numericValue.optional(),
  })
  .refine((r) => r.minMarks != null || r.maxMarks != null, {
    message:
      "Numerical rubric must provide at least one of minMarks or maxMarks",
  })
  .refine((r) => r.minScore == null || r.maxScore != null, {
    message: "maxScore must be provided when minScore is provided",
  })
  .refine((r) => r.minMarks != null || (r.maxMarks ?? 0) > 0, {
    message: "When minMarks is omitted, maxMarks must be greater than 0",
  })
  .refine((r) => r.maxMarks != null || (r.minMarks ?? 0) < 0, {
    message: "When maxMarks is omitted, minMarks must be less than 0",
  })
  .transform((r) => ({
    ...r,
    minScore: r.minScore ?? 0,
    maxScore: r.maxScore ?? 1,
    minMarks: r.minMarks ?? 0,
    maxMarks: r.maxMarks ?? 0,
  }))
  .refine((r) => r.minMarks <= r.maxMarks, {
    message: "minMarks must be less than or equal to maxMarks",
  })
  .refine((r) => r.minScore < r.maxScore, {
    message: "minScore must be less than maxScore",
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
export type ImportedSubmission = {
  id: string;
  type: "INDIVIDUAL" | "TEAM";
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

export function buildSubmissionsFromStudents(
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

function toRubricType(type: string): RubricType {
  if (type === "boolean") return RubricType.BOOLEAN;
  if (type === "ordinal") return RubricType.ORDINAL;
  return RubricType.NUMERICAL;
}

export async function persistImportData(
  questions: ImportedQuestions,
  submissions: ImportedSubmission[],
): Promise<{
  questionCount: number;
  rubricCount: number;
  submissionCount: number;
  studentCount: number;
}> {
  // Transform submissions
  const submissionsById = submissions.map((submission) => ({
    id: submission.id,
    type: submission.type,
    teamName: submission.team,
    studentId:
      submission.type === "INDIVIDUAL" ? submission.students[0].id : undefined,
  }));

  // Transform students
  const studentsWithTeam = submissions.flatMap((submission) =>
    submission.students.map((student) => ({
      id: student.id,
      familyName: student.familyName,
      firstName: student.firstName,
      teamName: submission.type === "TEAM" ? submission.team : undefined,
    })),
  );

  // Transform questions
  const questionsById = questions.map((question, position) => ({
    id: question.id,
    label: question.label ?? null,
    position,
  }));

  // Transform rubrics
  const rubricRows = questions.flatMap((question) =>
    question.rubrics.map((rubric, position) => ({
      id: rubric.id,
      questionId: question.id,
      position,
      description: rubric.description ?? null,
      label: rubric.label ?? null,
      type: rubric.type,
    })),
  );

  const booleanRubricRows = questions.flatMap((question) =>
    question.rubrics.flatMap((rubric) =>
      rubric.type === "boolean"
        ? [
            {
              rubricId: rubric.id,
              marks: rubric.marks,
            },
          ]
        : [],
    ),
  );

  const numericalRubricRows = questions.flatMap((question) =>
    question.rubrics.flatMap((rubric) =>
      rubric.type === "numerical"
        ? [
            {
              rubricId: rubric.id,
              minScore: rubric.minScore,
              maxScore: rubric.maxScore,
              minMarks: rubric.minMarks,
              maxMarks: rubric.maxMarks,
            },
          ]
        : [],
    ),
  );

  const ordinalRubricSources = questions.flatMap((question) =>
    question.rubrics.flatMap((rubric) =>
      rubric.type === "ordinal"
        ? [
            {
              rubricId: rubric.id,
              marks: rubric.marks,
            },
          ]
        : [],
    ),
  );

  const questionIds = questionsById.map((question) => question.id);
  const rubricIds = rubricRows.map((rubric) => rubric.id);
  const rubricTypeById = new Map(
    rubricRows.map((rubric) => [rubric.id, toRubricType(rubric.type)]),
  );

  return prisma.$transaction(async (tx) => {
    const existingRubrics = await tx.rubric.findMany({
      where: { id: { in: rubricIds } },
      select: {
        id: true,
        type: true,
      },
    });

    const rubricsToRecreate = existingRubrics.flatMap((rubric) => {
      const nextType = rubricTypeById.get(rubric.id);

      if (nextType == null || nextType === rubric.type) {
        return [];
      }

      return [rubric.id];
    });

    if (rubricsToRecreate.length > 0) {
      await tx.rubric.deleteMany({
        where: { id: { in: rubricsToRecreate } },
      });
    }

    // Create or update teams first
    const teamNames = new Set(
      submissionsById
        .filter((s) => s.type === "TEAM" && s.teamName)
        .map((s) => s.teamName!),
    );

    const teamsByName = new Map<string, string>(); // Map of name -> id

    const teamResults = await Promise.all(
      Array.from(teamNames).map((teamName) =>
        tx.team.upsert({
          where: { name: teamName },
          update: {},
          create: {
            id: `team-${teamName}`,
            name: teamName,
          },
          select: { id: true },
        }),
      ),
    );

    Array.from(teamNames).forEach((teamName, index) => {
      teamsByName.set(teamName, teamResults[index].id);
    });

    // Create or update questions and students in parallel
    await Promise.all([
      ...questionsById.map((question) =>
        tx.question.upsert({
          where: { id: question.id },
          create: question,
          update: {
            label: question.label,
            position: question.position,
          },
        }),
      ),
      ...studentsWithTeam.map((student) =>
        tx.student.upsert({
          where: { id: student.id },
          create: {
            id: student.id,
            familyName: student.familyName,
            firstName: student.firstName,
            teams: student.teamName
              ? {
                  connect: [{ name: student.teamName }],
                }
              : undefined,
          },
          update: {
            familyName: student.familyName,
            firstName: student.firstName,
            teams:
              student.teamName != null
                ? {
                    set: [{ name: student.teamName }],
                  }
                : { set: [] },
          },
        }),
      ),
    ]);

    // Create or update submissions (depends on students existing)
    await Promise.all(
      submissionsById.map((submission) =>
        tx.submission.upsert({
          where: { id: submission.id },
          create: {
            id: submission.id,
            type: submission.type as SubmissionType,
            teamId:
              submission.type === "TEAM" && submission.teamName
                ? teamsByName.get(submission.teamName)
                : null,
            studentId:
              submission.type === "INDIVIDUAL" ? submission.studentId : null,
          },
          update: {
            type: submission.type as SubmissionType,
            teamId:
              submission.type === "TEAM" && submission.teamName
                ? teamsByName.get(submission.teamName)
                : null,
            studentId:
              submission.type === "INDIVIDUAL" ? submission.studentId : null,
          },
        }),
      ),
    );

    await Promise.all(
      rubricRows.map((rubric) =>
        tx.rubric.upsert({
          where: { id: rubric.id },
          create: {
            id: rubric.id,
            questionId: rubric.questionId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            type: toRubricType(rubric.type),
          },
          update: {
            questionId: rubric.questionId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            type: toRubricType(rubric.type),
          },
        }),
      ),
    );

    // Upsert boolean and numerical rubrics in parallel
    await Promise.all([
      ...booleanRubricRows.map((booleanRubric) =>
        tx.booleanRubric.upsert({
          where: { rubricId: booleanRubric.rubricId },
          create: {
            rubricId: booleanRubric.rubricId,
            marks: new Prisma.Decimal(booleanRubric.marks),
          },
          update: {
            marks: new Prisma.Decimal(booleanRubric.marks),
          },
        }),
      ),
      ...numericalRubricRows.map((numericalRubric) =>
        tx.numericalRubric.upsert({
          where: { rubricId: numericalRubric.rubricId },
          create: {
            rubricId: numericalRubric.rubricId,
            minScore: new Prisma.Decimal(numericalRubric.minScore),
            maxScore: new Prisma.Decimal(numericalRubric.maxScore),
            minMarks: new Prisma.Decimal(numericalRubric.minMarks),
            maxMarks: new Prisma.Decimal(numericalRubric.maxMarks),
          },
          update: {
            minScore: new Prisma.Decimal(numericalRubric.minScore),
            maxScore: new Prisma.Decimal(numericalRubric.maxScore),
            minMarks: new Prisma.Decimal(numericalRubric.minMarks),
            maxMarks: new Prisma.Decimal(numericalRubric.maxMarks),
          },
        }),
      ),
    ]);

    // Upsert ordinal rubrics separately, fetching back their generated cuids
    // (OrdinalRubricValue.ordinalRubricId references OrdinalRubric.id, not Rubric.id)
    const upsertedOrdinalRubrics = await Promise.all(
      ordinalRubricSources.map((source) =>
        tx.ordinalRubric.upsert({
          where: { rubricId: source.rubricId },
          create: { rubricId: source.rubricId },
          update: {},
          select: { id: true, rubricId: true },
        }),
      ),
    );

    // Map from Rubric.id -> OrdinalRubric.id (cuid)
    const ordinalRubricIdByRubricId = new Map(
      upsertedOrdinalRubrics.map((r) => [r.rubricId, r.id]),
    );

    if (ordinalRubricSources.length > 0) {
      const ordinalRubricCuids = upsertedOrdinalRubrics.map((r) => r.id);

      // Build set of valid (ordinalRubricId cuid, label) pairs
      const validPairs = ordinalRubricSources.flatMap((source) => {
        const ordinalRubricId = ordinalRubricIdByRubricId.get(source.rubricId);
        if (ordinalRubricId == null) return [];

        return Object.keys(source.marks).map((label) => ({
          AND: [{ ordinalRubricId }, { label }],
        }));
      });

      // Delete obsolete labels and upsert all values in one request
      await Promise.all([
        tx.ordinalRubricValue.deleteMany({
          where: {
            ordinalRubricId: { in: ordinalRubricCuids },
            NOT: { OR: validPairs },
          },
        }),
        ...ordinalRubricSources.flatMap((source) => {
          const ordinalRubricId = ordinalRubricIdByRubricId.get(
            source.rubricId,
          );
          if (ordinalRubricId == null) return [];

          return Object.entries(source.marks).map(([label, mark]) =>
            tx.ordinalRubricValue.upsert({
              where: {
                ordinalRubricId_label: { ordinalRubricId, label },
              },
              create: {
                ordinalRubricId,
                label,
                marks: new Prisma.Decimal(mark),
              },
              update: {
                marks: new Prisma.Decimal(mark),
              },
            }),
          );
        }),
      ]);
    }

    return {
      questionCount: questionIds.length,
      rubricCount: rubricIds.length,
      submissionCount: submissionsById.length,
      studentCount: studentsWithTeam.length,
    };
  });
}
