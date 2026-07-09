export type CompletionMetric = { completed: number; total: number };

export type AssessmentCompletionInput = {
	submissionIds: string[];
	questions: Array<{ id: string; criterionCount: number }>;
	assessmentCounts: Array<{
		submissionId: string;
		questionId: string;
		assessmentCount: number;
	}>;
};

export type AssessmentCompletion = {
	totalSubmissions: number;
	totalQuestions: number;
	completedQuestionCountBySubmissionId: Map<string, number>;
	completedSubmissionCountByQuestionId: Map<string, number>;
	completedSubmissions: number;
	completedQuestions: number;
};

export function buildAssessmentCompletion({
	submissionIds,
	questions,
	assessmentCounts,
}: AssessmentCompletionInput): AssessmentCompletion {
	const totalSubmissions = submissionIds.length;
	const totalQuestions = questions.length;

	const assessmentCountByKey = new Map<string, number>(
		assessmentCounts.map(({ submissionId, questionId, assessmentCount }) => [
			`${submissionId}:${questionId}`,
			assessmentCount,
		]),
	);

	const completedQuestionCountBySubmissionId = new Map<string, number>();
	const completedSubmissionCountByQuestionId = new Map<string, number>(
		questions.map((question) => [question.id, 0]),
	);

	for (const submissionId of submissionIds) {
		let completedQuestionCount = 0;

		for (const question of questions) {
			const assessmentCount =
				assessmentCountByKey.get(`${submissionId}:${question.id}`) ?? 0;
			const isComplete =
				question.criterionCount === 0 ||
				assessmentCount >= question.criterionCount;

			if (isComplete) {
				completedQuestionCount += 1;
				completedSubmissionCountByQuestionId.set(
					question.id,
					(completedSubmissionCountByQuestionId.get(question.id) ?? 0) + 1,
				);
			}
		}

		completedQuestionCountBySubmissionId.set(
			submissionId,
			completedQuestionCount,
		);
	}

	const completedSubmissions =
		totalQuestions === 0
			? totalSubmissions
			: submissionIds.filter(
					(submissionId) =>
						completedQuestionCountBySubmissionId.get(submissionId) ===
						totalQuestions,
				).length;

	const completedQuestions =
		totalSubmissions === 0
			? totalQuestions
			: questions.filter(
					(question) =>
						completedSubmissionCountByQuestionId.get(question.id) ===
						totalSubmissions,
				).length;

	return {
		totalSubmissions,
		totalQuestions,
		completedQuestionCountBySubmissionId,
		completedSubmissionCountByQuestionId,
		completedSubmissions,
		completedQuestions,
	};
}
