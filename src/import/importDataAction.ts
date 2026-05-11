"use server";

import { Prisma, RubricType } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { prettifyError, ZodError } from "zod";
import { prisma } from "../db/prisma";
import {
  buildPapersFromStudents,
  parseQuestionsYaml,
  parseStudentsCsv,
} from "./importData";
import type { ImportState } from "./importState";

export type { ImportState } from "./importState";

export async function importDataAction(
  _previousState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const questionsYaml = String(formData.get("questionsYaml") ?? "");
  const studentsCsv = String(formData.get("studentsCsv") ?? "");

  try {
    const questions = parseQuestionsYaml(questionsYaml);
    const students = parseStudentsCsv(studentsCsv);
    const papers = buildPapersFromStudents(students);

    const papersById = papers.map((paper) => ({
      id: paper.id,
      label: paper.label,
      team: paper.team,
    }));

    const studentsWithPaper = papers.flatMap((paper) =>
      paper.students.map((student) => ({
        id: student.id,
        familyName: student.familyName,
        firstName: student.firstName,
        team: student.team,
        paperId: paper.id,
      })),
    );

    const questionsById = questions.map((question, position) => ({
      id: question.id,
      label: question.label ?? null,
      position,
    }));

    const rubricRows = questions.flatMap((question) =>
      question.rubrics.map((rubric, position) => ({
        id: rubric.id,
        questionId: question.id,
        position,
        description: rubric.description ?? null,
        label: rubric.label ?? null,
        type:
          rubric.type === "boolean"
            ? RubricType.BOOLEAN
            : rubric.type === "ordinal"
              ? RubricType.ORDINAL
              : RubricType.NUMERICAL,
      })),
    );

    const booleanRubricRows = questions.flatMap((question) =>
      question.rubrics.flatMap((rubric) =>
        rubric.type === "boolean"
          ? [
              {
                rubricId: rubric.id,
                marks: new Prisma.Decimal(rubric.marks),
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
                min: new Prisma.Decimal(rubric.min),
                max: new Prisma.Decimal(rubric.max),
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
                values: rubric.values,
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
      rubricRows.map((rubric) => [rubric.id, rubric.type]),
    );

    const result = await prisma.$transaction(async (tx) => {
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
        ...papersById.map((paper) =>
          tx.paper.upsert({
            where: { id: paper.id },
            create: paper,
            update: {
              label: paper.label,
              team: paper.team,
            },
          }),
        ),
      ]);

      await Promise.all(
        studentsWithPaper.map((student) =>
          tx.student.upsert({
            where: { id: student.id },
            create: student,
            update: {
              familyName: student.familyName,
              firstName: student.firstName,
              team: student.team,
              paperId: student.paperId,
            },
          }),
        ),
      );

      await Promise.all(
        rubricRows.map((rubric) =>
          tx.rubric.upsert({
            where: { id: rubric.id },
            create: rubric,
            update: {
              questionId: rubric.questionId,
              position: rubric.position,
              description: rubric.description,
              label: rubric.label,
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
              marks: booleanRubric.marks,
            },
            update: {
              marks: booleanRubric.marks,
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
              min: numericalRubric.min,
              max: numericalRubric.max,
            },
            update: {
              min: numericalRubric.min,
              max: numericalRubric.max,
            },
          }),
        ),
      ]);

      await tx.rubric.deleteMany({
        where: {
          questionId: { in: questionIds },
          id: { notIn: rubricIds },
        },
      });

      if (ordinalRubricSources.length > 0) {
        // Fetch the upserted ordinal rubric IDs to use in value rows
        const persistedOrdinalRubrics = await tx.ordinalRubric.findMany({
          where: {
            rubricId: { in: ordinalRubricIds },
          },
          select: {
            id: true,
            rubricId: true,
          },
        });

        const ordinalRubricIdByRubricId = new Map(
          persistedOrdinalRubrics.map((r) => [r.rubricId, r.id]),
        );

        const ordinalValueRows = ordinalRubricSources.flatMap((rubric) => {
          const ordinalRubricId = ordinalRubricIdByRubricId.get(
            rubric.rubricId,
          );

          if (ordinalRubricId == null) {
            return [];
          }

          return Object.entries(rubric.values).map(([label, score]) => ({
            ordinalRubricId,
            label,
            score: new Prisma.Decimal(score),
          }));
        });

        await tx.ordinalRubricValue.deleteMany({
          where: {
            ordinalRubricId: {
              in: persistedOrdinalRubrics.map((rubric) => rubric.id),
            },
          },
        });

        if (ordinalValueRows.length > 0) {
          await tx.ordinalRubricValue.createMany({
            data: ordinalValueRows,
          });
        }
      }

      return {
        questionCount: questionsById.length,
        rubricCount: rubricRows.length,
        paperCount: papersById.length,
        studentCount: studentsWithPaper.length,
      };
    });

    revalidateTag("questions", "seconds");
    revalidateTag("papers", "seconds");

    return {
      status: "success",
      message: `Imported ${result.questionCount} questions, ${result.rubricCount} rubrics, ${result.paperCount} papers, and ${result.studentCount} students. Existing records were updated in place.`,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        errors: [prettifyError(error)],
      };
    }

    if (error instanceof Error) {
      return {
        status: "error",
        errors: [error.message],
      };
    }

    return {
      status: "error",
      errors: ["Unknown import error"],
    };
  }
}
