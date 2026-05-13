import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./kysely";
import type { Submission } from "./types";

async function loadSubmissionsFromDb() {
  "use cache";
  cacheTag("submissions");
  cacheLife({ revalidate: 60 });

  return db
    .selectFrom("submission")
    .leftJoin("student", "student.id", "submission.studentId")
    .leftJoin("team", "team.id", "submission.teamId")
    .select([
      "submission.id as id",
      "submission.type as type",
      "student.familyName as studentFamilyName",
      "student.firstName as studentFirstName",
      "team.name as teamName",
    ])
    .orderBy("submission.id", "asc")
    .execute();
}

export async function loadSubmissions(): Promise<Submission[]> {
  const submissions = await loadSubmissionsFromDb();

  return submissions.map((submission) => {
    if (submission.type === "team") {
      return {
        id: String(submission.id),
        type: "team",
        teamName: submission.teamName ?? String(submission.id),
      };
    }

    return {
      id: String(submission.id),
      type: "individual",
      studentName:
        submission.studentFamilyName != null &&
        submission.studentFirstName != null
          ? `${submission.studentFamilyName} ${submission.studentFirstName}`.trim()
          : String(submission.id),
    };
  });
}
