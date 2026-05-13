import type { Submission } from "@/db/types";

export function getSubmissionLabel(submission: Submission): string {
  if (submission.type === "team" && submission.teamName) {
    return submission.teamName;
  }
  if (submission.type === "individual" && submission.studentName) {
    return submission.studentName;
  }
  return submission.id;
}
