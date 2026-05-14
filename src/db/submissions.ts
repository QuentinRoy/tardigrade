import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./kysely";
import type { Submission } from "./types";

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatStudentName(lastName: string, firstName: string): string {
  return `${lastName} ${firstName}`.trim();
}

async function loadSubmissionsFromDb() {
  "use cache";
  cacheTag("submissions");
  cacheLife({ revalidate: 60 });

  const [submissions, teamMemberRows] = await Promise.all([
    db
      .selectFrom("submission")
      .leftJoin("student", "student.id", "submission.studentId")
      .leftJoin("team", "team.id", "submission.teamId")
      .select([
        "submission.id as id",
        "submission.type as type",
        "student.lastName as studentLastName",
        "student.firstName as studentFirstName",
        "team.name as teamName",
      ])
      .orderBy("submission.id", "asc")
      .execute(),
    db
      .selectFrom("submission")
      .innerJoin("studentToTeam", "studentToTeam.teamId", "submission.teamId")
      .innerJoin("student", "student.id", "studentToTeam.studentId")
      .where("submission.type", "=", "team")
      .select([
        "submission.id as submissionId",
        "student.lastName as studentLastName",
        "student.firstName as studentFirstName",
      ])
      .orderBy("submission.id", "asc")
      .orderBy("student.lastName", "asc")
      .orderBy("student.firstName", "asc")
      .execute(),
  ]);

  const teamMembersBySubmissionId = new Map<string, string[]>();

  for (const row of teamMemberRows) {
    if (row.studentLastName == null || row.studentFirstName == null) {
      continue;
    }

    const submissionId = String(row.submissionId);
    const formattedName = formatStudentName(
      row.studentLastName,
      row.studentFirstName,
    );
    if (formattedName.length === 0) {
      continue;
    }
    const names = teamMembersBySubmissionId.get(submissionId) ?? [];
    names.push(formattedName);
    teamMembersBySubmissionId.set(submissionId, names);
  }

  return {
    submissions,
    teamMembersBySubmissionId,
  };
}

export async function loadSubmissions(): Promise<Submission[]> {
  const { submissions, teamMembersBySubmissionId } =
    await loadSubmissionsFromDb();

  return submissions.map((submission) => {
    if (submission.type === "team") {
      const displayLabel = submission.teamName ?? String(submission.id);
      const memberNames =
        teamMembersBySubmissionId.get(String(submission.id)) ?? [];
      const searchKeys = Array.from(
        new Set(
          [displayLabel, ...memberNames]
            .map(normalizeSearchValue)
            .filter((value) => value.length > 0),
        ),
      );

      return {
        id: String(submission.id),
        type: "team",
        teamName: displayLabel,
        displayLabel,
        memberNames,
        searchKeys,
      };
    }

    const displayLabel =
      submission.studentLastName != null && submission.studentFirstName != null
        ? formatStudentName(
            submission.studentLastName,
            submission.studentFirstName,
          )
        : String(submission.id);
    const searchKeys = [normalizeSearchValue(displayLabel)].filter(
      (value) => value.length > 0,
    );

    return {
      id: String(submission.id),
      type: "individual",
      studentName: displayLabel,
      displayLabel,
      memberNames: [],
      searchKeys,
    };
  });
}
