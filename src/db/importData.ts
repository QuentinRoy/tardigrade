import "server-only";
import { Prisma, RubricType, SubmissionType } from "@prisma/client";
import type {
  ImportedQuestions,
  ImportedSubmission,
} from "../import/importData";
import { prisma } from "./prisma";

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

  const ordinalRubricRows = ordinalRubricSources.map(({ rubricId }) => ({
    rubricId,
  }));

  const questionIds = questionsById.map((question) => question.id);
  const rubricIds = rubricRows.map((rubric) => rubric.id);
  const ordinalRubricIds = ordinalRubricRows.map((rubric) => rubric.rubricId);
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

    for (const teamName of teamNames) {
      const team = await tx.team.upsert({
        where: { name: teamName },
        update: {},
        create: {
          id: `team-${teamName}`,
          name: teamName,
        },
        select: { id: true },
      });
      teamsByName.set(teamName, team.id);
    }

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
      ...submissionsById.map((submission) =>
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
    ]);

    // Create or update students and link to teams
    await Promise.all(
      studentsWithTeam.map((student) =>
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
      ...ordinalRubricRows.map((ordinalRubric) =>
        tx.ordinalRubric.upsert({
          where: { rubricId: ordinalRubric.rubricId },
          create: {
            rubricId: ordinalRubric.rubricId,
          },
          update: {},
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

    const ordinalRubricIdsWithMarks = new Map(
      ordinalRubricSources.map((source) => [source.rubricId, source.marks]),
    );

    for (const ordinalRubricId of ordinalRubricIds) {
      const marks = ordinalRubricIdsWithMarks.get(ordinalRubricId);
      if (marks == null) continue;

      const existingValues = await tx.ordinalRubricValue.findMany({
        where: { ordinalRubricId },
        select: { label: true },
      });

      const existingLabels = new Set(existingValues.map((v) => v.label));
      const nextLabels = Object.keys(marks);
      const labelsToDelete = new Set(
        [...existingLabels].filter((label) => !nextLabels.includes(label)),
      );

      if (labelsToDelete.size > 0) {
        await tx.ordinalRubricValue.deleteMany({
          where: {
            ordinalRubricId,
            label: { in: Array.from(labelsToDelete) },
          },
        });
      }

      await Promise.all(
        Object.entries(marks).map(([label, mark]) =>
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
        ),
      );
    }

    return {
      questionCount: questionIds.length,
      rubricCount: rubricIds.length,
      submissionCount: submissionsById.length,
      studentCount: studentsWithTeam.length,
    };
  });
}
