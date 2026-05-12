import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";
import type { Submission } from "./types";

async function loadSubmissionsFromDb() {
  "use cache";
  cacheTag("submissions");
  cacheLife({ revalidate: 60 });

  return prisma.submission.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      type: true,
      student: {
        select: { familyName: true, firstName: true },
      },
      team: {
        select: { name: true },
      },
    },
  });
}

export async function loadSubmissions(): Promise<Submission[]> {
  const submissions = await loadSubmissionsFromDb();

  return submissions.map((submission) => ({
    id: submission.id,
    type: submission.type,
    studentName:
      submission.student != null
        ? `${submission.student.familyName} ${submission.student.firstName}`.trim()
        : undefined,
    teamName: submission.team?.name,
  }));
}
