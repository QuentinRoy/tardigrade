import type { Submission } from "#submissions/types.ts";

export function getSubmissionLabel(submission: Submission): string {
	if (submission.displayLabel != null && submission.displayLabel.length > 0) {
		return submission.displayLabel;
	}
	if (submission.type === "group" && submission.groupName) {
		return submission.groupName;
	}
	if (submission.type === "individual" && submission.studentName) {
		return submission.studentName;
	}
	return submission.id;
}
