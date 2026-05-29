export type SubmissionNavigation<TSubmission extends { id: string }> = {
	currentSubmissionIndex: number;
	currentSubmission: TSubmission | undefined;
	previousSubmission: TSubmission | undefined;
	nextSubmission: TSubmission | undefined;
};

export function getSubmissionNavigation<TSubmission extends { id: string }>(
	submissions: TSubmission[],
	currentSubmissionId: string,
): SubmissionNavigation<TSubmission> {
	const currentSubmissionIndex = submissions.findIndex(
		(submission) => submission.id === currentSubmissionId,
	);
	const currentSubmission =
		currentSubmissionIndex === -1
			? undefined
			: submissions[currentSubmissionIndex];
	const previousSubmission =
		currentSubmissionIndex > 0
			? submissions[currentSubmissionIndex - 1]
			: undefined;
	const nextSubmission =
		currentSubmissionIndex >= 0 &&
		currentSubmissionIndex < submissions.length - 1
			? submissions[currentSubmissionIndex + 1]
			: undefined;

	return {
		currentSubmissionIndex,
		currentSubmission,
		previousSubmission,
		nextSubmission,
	};
}
