import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentQuestionCacheTag,
	CACHE_TAGS,
	cacheTags,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";

export type SubmissionProgressMetric = { completed: number; total: number };

// A question-scoped tag so that saving a rubric for question Q only invalidates
// the progress cache for Q, not for every other question. "assessments:all" is
// busted only by bulk imports, not by individual saves.
export function submissionQuestionProgressCacheTags(
	questionId: string,
): string[] {
	return [
		CACHE_TAGS.submissions,
		CACHE_TAGS.questions,
		assessmentQuestionCacheTag(questionId),
		CACHE_TAGS.assessmentsAll,
		`questions:${questionId}`,
	];
}

export function submissionOverviewProgressCacheTags(): string[] {
	return [CACHE_TAGS.submissions, CACHE_TAGS.questions, CACHE_TAGS.assessments];
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadSubmissionQuestionProgressFromDb(
	db: Kysely<DB>,
	{
		questionId,
		projectId,
	}: { questionId: string; projectId?: string | undefined },
): Promise<Record<string, SubmissionProgressMetric>> {
	let submissionsQuery = db.selectFrom("submission");
	let rubricCountQuery = db.selectFrom("rubric");
	let assessmentCountsQuery = db.selectFrom("assessment");

	if (projectId != null) {
		const projectRowIdQuery = db
			.selectFrom("project")
			.select("rowId")
			.where("id", "=", projectId);

		submissionsQuery = submissionsQuery.where(
			"submission.projectId",
			"in",
			projectRowIdQuery,
		);
		rubricCountQuery = rubricCountQuery.where(
			"rubric.projectId",
			"in",
			projectRowIdQuery,
		);
		assessmentCountsQuery = assessmentCountsQuery.where(
			"assessment.projectId",
			"in",
			projectRowIdQuery,
		);
	}

	const [submissions, rubricCountRow, assessmentCounts] = await Promise.all([
		submissionsQuery.select("id").execute(),
		rubricCountQuery
			.innerJoin("question", "question.rowId", "rubric.questionId")
			.where("question.id", "=", questionId)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow(),
		assessmentCountsQuery
			.innerJoin("question", "question.rowId", "assessment.questionId")
			.leftJoin(
				"rubricAssessment",
				"rubricAssessment.assessmentId",
				"assessment.id",
			)
			.where("question.id", "=", questionId)
			.select((eb) => [
				"assessment.submissionId as submissionId",
				eb.fn.count<number>("rubricAssessment.id").as("completed"),
			])
			.groupBy("assessment.submissionId")
			.execute(),
	]);

	const totalRubrics = Number(rubricCountRow.count);
	const completedBySubmissionId = new Map<string, number>(
		assessmentCounts.map((row) => [
			String(row.submissionId),
			Number(row.completed),
		]),
	);

	return Object.fromEntries(
		submissions.map((submission) => {
			const submissionId = String(submission.id);
			const completed = Math.min(
				completedBySubmissionId.get(submissionId) ?? 0,
				totalRubrics,
			);

			return [submissionId, { completed, total: totalRubrics }];
		}),
	);
}

export async function loadSubmissionQuestionProgress(
	{ questionId, projectId }: { questionId: string; projectId?: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Record<string, SubmissionProgressMetric>> {
	"use cache";
	cacheTags(...submissionQuestionProgressCacheTags(questionId));
	cacheLife({ revalidate: 60 });

	return loadSubmissionQuestionProgressFromDb(db, { questionId, projectId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadSubmissionOverviewProgressFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId?: string | undefined } = {},
): Promise<Record<string, SubmissionProgressMetric>> {
	let submissionsQuery = db.selectFrom("submission");
	let questionsQuery = db.selectFrom("question");
	let assessmentsQuery = db.selectFrom("assessment");

	if (projectId != null) {
		const projectRowIdQuery = db
			.selectFrom("project")
			.select("rowId")
			.where("id", "=", projectId);

		submissionsQuery = submissionsQuery.where(
			"submission.projectId",
			"in",
			projectRowIdQuery,
		);
		questionsQuery = questionsQuery.where(
			"question.projectId",
			"in",
			projectRowIdQuery,
		);
		assessmentsQuery = assessmentsQuery.where(
			"assessment.projectId",
			"in",
			projectRowIdQuery,
		);
	}

	const [submissions, questions, assessments] = await Promise.all([
		submissionsQuery.select("id").execute(),
		questionsQuery
			.leftJoin("rubric", "rubric.questionId", "question.rowId")
			.select((eb) => [
				"question.id as id",
				eb.fn.count<number>("rubric.id").as("rubricCount"),
			])
			.groupBy("question.id")
			.execute(),
		assessmentsQuery
			.innerJoin("question", "question.rowId", "assessment.questionId")
			.leftJoin(
				"rubricAssessment",
				"rubricAssessment.assessmentId",
				"assessment.id",
			)
			.select((eb) => [
				"assessment.submissionId as submissionId",
				"question.id as questionId",
				eb.fn.count<number>("rubricAssessment.id").as("assessmentCount"),
			])
			.groupBy(["assessment.submissionId", "question.id"])
			.execute(),
	]);

	const totalQuestions = questions.length;
	const zeroRubricQuestionCount = questions.filter(
		(question) => Number(question.rubricCount) === 0,
	).length;

	const rubricCountByQuestionId = new Map<string, number>(
		questions.map((question) => [question.id, Number(question.rubricCount)]),
	);

	const completedQuestionCountBySubmissionId = new Map<string, number>(
		submissions.map((submission) => [
			String(submission.id),
			zeroRubricQuestionCount,
		]),
	);

	for (const assessment of assessments) {
		const requiredRubrics =
			rubricCountByQuestionId.get(assessment.questionId) ?? 0;
		if (requiredRubrics === 0) {
			continue;
		}

		if (Number(assessment.assessmentCount) >= requiredRubrics) {
			const submissionId = String(assessment.submissionId);
			completedQuestionCountBySubmissionId.set(
				submissionId,
				(completedQuestionCountBySubmissionId.get(submissionId) ?? 0) + 1,
			);
		}
	}

	return Object.fromEntries(
		submissions.map((submission) => {
			const submissionId = String(submission.id);
			const completed = Math.min(
				completedQuestionCountBySubmissionId.get(submissionId) ?? 0,
				totalQuestions,
			);

			return [submissionId, { completed, total: totalQuestions }];
		}),
	);
}

export async function loadSubmissionOverviewProgress(
	{ projectId }: { projectId?: string } = {},
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Record<string, SubmissionProgressMetric>> {
	"use cache";
	cacheTags(...submissionOverviewProgressCacheTags());
	cacheLife({ revalidate: 60 });

	return loadSubmissionOverviewProgressFromDb(db, { projectId });
}
