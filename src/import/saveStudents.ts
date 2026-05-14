import "server-only";
import { db } from "../db/kysely";
import type { NormalizedImportedSubmission } from "./types";

export async function saveStudents(
  submissions: NormalizedImportedSubmission[],
): Promise<{
  submissionCount: number;
  studentCount: number;
}> {
  const submissionsByOwner = submissions.map((submission) => {
    const firstStudent = submission.students[0];
    let studentId: string | undefined;

    if (submission.type === "individual") {
      if (firstStudent == null) {
        throw new Error(
          `Individual submission ${submission.id} must include at least one student.`,
        );
      } else if (submission.students.length > 1) {
        throw new Error(
          `Individual submission ${submission.id} cannot include more than one student.`,
        );
      }
      studentId = firstStudent.id;
    }

    return {
      type: submission.type,
      teamName: submission.team,
      studentId,
    };
  });

  const studentsWithTeam = submissions.flatMap((submission) =>
    submission.students.map((student) => ({
      id: student.id,
      familyName: student.familyName,
      firstName: student.firstName,
      teamName: submission.type === "team" ? submission.team : undefined,
    })),
  );

  return db.transaction().execute(async (tx) => {
    const teamNames = new Set(
      submissionsByOwner
        .filter((s) => s.type === "team" && s.teamName)
        .map((s) => s.teamName!),
    );

    const teamsByName = new Map<string, number>();

    if (teamNames.size > 0) {
      await tx
        .insertInto("team")
        .values(Array.from(teamNames).map((teamName) => ({ name: teamName })))
        .onConflict((conflict) => conflict.column("name").doNothing())
        .execute();

      const teamResults = await tx
        .selectFrom("team")
        .select(["id", "name"])
        .where("name", "in", Array.from(teamNames))
        .execute();

      for (const team of teamResults) {
        teamsByName.set(team.name, team.id);
      }
    }

    if (studentsWithTeam.length > 0) {
      await tx
        .insertInto("student")
        .values(
          studentsWithTeam.map((student) => ({
            id: student.id,
            familyName: student.familyName,
            firstName: student.firstName,
          })),
        )
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet((expressionBuilder) => ({
            familyName: expressionBuilder.ref("excluded.familyName"),
            firstName: expressionBuilder.ref("excluded.firstName"),
          })),
        )
        .execute();
    }

    const affectedStudentIds = Array.from(
      new Set(studentsWithTeam.map((student) => student.id)),
    );

    if (affectedStudentIds.length > 0) {
      await tx
        .deleteFrom("studentToTeam")
        .where("studentId", "in", affectedStudentIds)
        .execute();

      const studentTeamLinks = studentsWithTeam.flatMap((student) => {
        if (student.teamName == null) {
          return [];
        }

        const teamId = teamsByName.get(student.teamName);

        if (teamId == null) {
          throw new Error(
            `Team assignment is missing a mapped team for "${student.teamName}".`,
          );
        }

        return [{ studentId: student.id, teamId }];
      });

      if (studentTeamLinks.length > 0) {
        await tx
          .insertInto("studentToTeam")
          .values(studentTeamLinks)
          .onConflict((conflict) =>
            conflict.columns(["studentId", "teamId"]).doNothing(),
          )
          .execute();
      }
    }

    const teamSubmissions = submissionsByOwner.flatMap((submission) => {
      if (submission.type !== "team") {
        return [];
      }

      const teamId =
        submission.teamName != null
          ? teamsByName.get(submission.teamName)
          : undefined;

      if (teamId == null) {
        throw new Error(
          `Team submission is missing a mapped team for "${submission.teamName ?? "unknown"}".`,
        );
      }

      return [
        {
          type: "team" as const,
          teamId,
          studentId: null,
        },
      ];
    });

    if (teamSubmissions.length > 0) {
      await tx
        .insertInto("submission")
        .values(teamSubmissions)
        .onConflict((conflict) =>
          conflict.column("teamId").doUpdateSet({
            type: "team",
            teamId: (expressionBuilder) =>
              expressionBuilder.ref("excluded.teamId"),
            studentId: null,
          }),
        )
        .execute();
    }

    const individualSubmissions = submissionsByOwner.flatMap((submission) => {
      if (submission.type !== "individual") {
        return [];
      }

      if (submission.studentId == null) {
        throw new Error("Individual submission is missing student id.");
      }

      return [
        {
          type: "individual" as const,
          studentId: submission.studentId,
          teamId: null,
        },
      ];
    });

    if (individualSubmissions.length > 0) {
      await tx
        .insertInto("submission")
        .values(individualSubmissions)
        .onConflict((conflict) =>
          conflict.column("studentId").doUpdateSet({
            type: "individual",
            studentId: (expressionBuilder) =>
              expressionBuilder.ref("excluded.studentId"),
            teamId: null,
          }),
        )
        .execute();
    }

    return {
      submissionCount: submissionsByOwner.length,
      studentCount: studentsWithTeam.length,
    };
  });
}
