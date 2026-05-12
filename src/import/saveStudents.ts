import "server-only";
import { SubmissionType } from "@prisma/client";
import { prisma } from "../db/prisma";
import type { ImportedSubmission } from "./types";

export async function saveStudents(submissions: ImportedSubmission[]): Promise<{
  submissionCount: number;
  studentCount: number;
}> {
  const submissionsById = submissions.map((submission) => ({
    id: submission.id,
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
      submissionsById
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

    return {
      submissionCount: submissionsById.length,
      studentCount: studentsWithTeam.length,
    };
  });
}
