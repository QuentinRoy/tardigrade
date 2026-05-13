import "server-only";
import { SubmissionType } from "@prisma/client";
import { prisma } from "../db/prisma";
import type { ImportedSubmission } from "./types";

export async function saveStudents(submissions: ImportedSubmission[]): Promise<{
  submissionCount: number;
  studentCount: number;
}> {
  const submissionsByOwner = submissions.map((submission) => ({
    type: submission.type,
    teamName: submission.team,
    studentId:
      submission.type === "INDIVIDUAL" ? submission.students[0].id : undefined,
  }));

  const studentsWithTeam = submissions.flatMap((submission) =>
    submission.students.map((student) => ({
      id: student.id,
      familyName: student.familyName,
      firstName: student.firstName,
      teamName: submission.type === "TEAM" ? submission.team : undefined,
    })),
  );

  return prisma.$transaction(async (tx) => {
    const teamNames = new Set(
      submissionsByOwner
        .filter((s) => s.type === "TEAM" && s.teamName)
        .map((s) => s.teamName!),
    );

    const teamsByName = new Map<string, string>();

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
      submissionsByOwner.map((submission) => {
        if (submission.type === "TEAM") {
          const teamId =
            submission.teamName != null
              ? teamsByName.get(submission.teamName)
              : undefined;

          if (teamId == null) {
            throw new Error(
              `Team submission is missing a mapped team for "${submission.teamName ?? "unknown"}".`,
            );
          }

          return tx.submission.upsert({
            where: { teamId },
            create: {
              type: SubmissionType.TEAM,
              teamId,
              studentId: null,
            },
            update: {
              type: SubmissionType.TEAM,
              teamId,
              studentId: null,
            },
          });
        }

        if (submission.studentId == null) {
          throw new Error("Individual submission is missing student id.");
        }

        return tx.submission.upsert({
          where: { studentId: submission.studentId },
          create: {
            type: SubmissionType.INDIVIDUAL,
            studentId: submission.studentId,
            teamId: null,
          },
          update: {
            type: SubmissionType.INDIVIDUAL,
            studentId: submission.studentId,
            teamId: null,
          },
        });
      }),
    );

    return {
      submissionCount: submissionsByOwner.length,
      studentCount: studentsWithTeam.length,
    };
  });
}
