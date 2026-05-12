import type { Submission } from "@/db/types";

export function getSubmissionLabel(submission: Submission): string {
  if (submission.type === "TEAM" && submission.teamName) {
    return submission.teamName;
  }
  if (submission.type === "INDIVIDUAL" && submission.studentName) {
    return submission.studentName;
  }
  return submission.id;
}
