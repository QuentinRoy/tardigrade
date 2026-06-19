import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import {
	assessmentAggregateCacheTag,
	assessmentImportCacheTag,
	assessmentProgressForQuestionCacheTag,
	cacheTags,
	questionListCacheTag,
	submissionListCacheTag,
} from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import {
	type AssessmentCompletionInput,
	buildAssessmentCompletion,
	type CompletionMetric,
} from "./assessmentCompletion.ts";
import type { AssessmentCompletionSummary } from "./types.ts";

// Question-scoped progress: saving a rubric for question Q busts
// `assessments:question:Q` (and the coarse aggregate), so progress for Q
// refreshes without busting other questions; the import tag covers bulk imports,
// and the list tags cover roster and definition changes.
export function assessedRubricCountsBySubmissionCacheTags(
	questionId: string,
): string[] {
	return [
		submissionListCacheTag(),
		questionListCacheTag(),
		assessmentProgressForQuestionCacheTag(questionId),
		assessmentImportCacheTag(),
	];
}

export function assessmentCompletionBySubmissionCacheTags(): string[] {
	return [
		submissionListCacheTag(),
		questionListCacheTag(),
		assessmentAggregateCacheTag(),
	];
}

export function assessmentCompletionSummaryCacheTags(): string[] {
	return [
		submissionListCacheTag(),
		questionListCacheTag(),
		assessmentAggregateCacheTag(),
	];
}

// `db` may be the global client or a caller-supplied transaction.
// Shared rows for `buildAssessmentCompletion`, scoped to a single project.
export async function loadAssessmentCompletionRowsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<AssessmentCompletionInput> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [submissions, questions, assessmentCounts] = await Promise.all([
		db
			.selectFrom("submission")
			.where("submission.projectId", "in", projectRowIdQuery)
			.select("id")
			.execute(),
		db
			.selectFrom("question")
			.where("question.projectId", "in", projectRowIdQuery)
			.leftJoin("rubric", "rubric.questionId", "question.rowId")
			.select((eb) => [
				"question.id as id",
				eb.fn.count<number>("rubric.id").as("rubricCount"),
			])
			.groupBy("question.id")
			.execute(),
		db
			.selectFrom("assessment")
			.where("assessment.projectId", "in", projectRowIdQuery)
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

	return {
		submissionIds: submissions.map((submission) => String(submission.id)),
		questions: questions.map((question) => ({
			id: question.id,
			rubricCount: Number(question.rubricCount),
		})),
		assessmentCounts: assessmentCounts.map((row) => ({
			submissionId: String(row.submissionId),
			questionId: row.questionId,
			assessmentCount: Number(row.assessmentCount),
		})),
	};
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessmentCompletionBySubmissionFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<Record<string, CompletionMetric>> {
	const rows = await loadAssessmentCompletionRowsFromDb(db, { projectId });
	const completion = buildAssessmentCompletion(rows);

	return Object.fromEntries(
		rows.submissionIds.map((submissionId) => [
			submissionId,
			{
				completed:
					completion.completedQuestionCountBySubmissionId.get(submissionId) ??
					0,
				total: completion.totalQuestions,
			},
		]),
	);
}

export async function loadAssessmentCompletionBySubmission(
	{ projectId }: { projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Record<string, CompletionMetric>> {
	"use cache";
	cacheTags(...assessmentCompletionBySubmissionCacheTags());
	cacheLife("projection");

	return loadAssessmentCompletionBySubmissionFromDb(db, { projectId });
}

export type AssessedRubricCounts = {
	totalRubrics: number;
	completedBySubmissionId: Map<string, number>;
};

// `db` may be the global client or a caller-supplied transaction. Counts only —
// does not load submission ids, so a caller that already has the project's
// submissions (for example a page that also renders the roster) can build the
// per-submission result from `buildAssessedRubricCountsBySubmission` below
// instead of querying submissions twice (Finding 7).
export async function loadAssessedRubricCountsFromDb(
	db: Kysely<DB>,
	{ questionId, projectId }: { questionId: string; projectId: string },
): Promise<AssessedRubricCounts> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [rubricCountRow, assessmentCounts] = await Promise.all([
		db
			.selectFrom("rubric")
			.where("rubric.projectId", "in", projectRowIdQuery)
			.innerJoin("question", "question.rowId", "rubric.questionId")
			.where("question.id", "=", questionId)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow(),
		db
			.selectFrom("assessment")
			.where("assessment.projectId", "in", projectRowIdQuery)
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

	return {
		totalRubrics: Number(rubricCountRow.count),
		completedBySubmissionId: new Map(
			assessmentCounts.map((row) => [
				String(row.submissionId),
				Number(row.completed),
			]),
		),
	};
}

// Plain wrapper exposing the default db for callers outside `src/`, such as a
// page composing this inside its own `"use cache"` scope (ADR 0007 rule 5).
export async function loadAssessedRubricCounts(
	{ questionId, projectId }: { questionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<AssessedRubricCounts> {
	return loadAssessedRubricCountsFromDb(db, { questionId, projectId });
}

// Pure builder: per-submission completed/total rubric counts for one question,
// from already-loaded submission ids plus the counts above.
export function buildAssessedRubricCountsBySubmission(
	submissionIds: string[],
	{ totalRubrics, completedBySubmissionId }: AssessedRubricCounts,
): Record<string, CompletionMetric> {
	return Object.fromEntries(
		submissionIds.map((submissionId) => {
			const completed = Math.min(
				completedBySubmissionId.get(submissionId) ?? 0,
				totalRubrics,
			);

			return [submissionId, { completed, total: totalRubrics }];
		}),
	);
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessedRubricCountsBySubmissionFromDb(
	db: Kysely<DB>,
	{ questionId, projectId }: { questionId: string; projectId: string },
): Promise<Record<string, CompletionMetric>> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [submissions, counts] = await Promise.all([
		db
			.selectFrom("submission")
			.where("submission.projectId", "in", projectRowIdQuery)
			.select("id")
			.execute(),
		loadAssessedRubricCountsFromDb(db, { questionId, projectId }),
	]);

	return buildAssessedRubricCountsBySubmission(
		submissions.map((submission) => String(submission.id)),
		counts,
	);
}

export async function loadAssessedRubricCountsBySubmission(
	{ questionId, projectId }: { questionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Record<string, CompletionMetric>> {
	"use cache";
	cacheTags(...assessedRubricCountsBySubmissionCacheTags(questionId));
	cacheLife("projection");

	return loadAssessedRubricCountsBySubmissionFromDb(db, {
		questionId,
		projectId,
	});
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessmentCompletionSummaryFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<AssessmentCompletionSummary> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [rows, rubricAssessmentsCount] = await Promise.all([
		loadAssessmentCompletionRowsFromDb(db, { projectId }),
		db
			.selectFrom("rubricAssessment")
			.innerJoin("assessment", "assessment.id", "rubricAssessment.assessmentId")
			.where("assessment.projectId", "in", projectRowIdQuery)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow(),
	]);

	const completion = buildAssessmentCompletion(rows);

	const totalRubricsInProject = rows.questions.reduce(
		(sum, question) => sum + question.rubricCount,
		0,
	);
	const totalExpectedRubricAssessments =
		completion.totalSubmissions * totalRubricsInProject;

	return {
		submissions: {
			completed: completion.completedSubmissions,
			total: completion.totalSubmissions,
		},
		questions: {
			completed: completion.completedQuestions,
			total: completion.totalQuestions,
		},
		rubrics: {
			completed: Math.min(
				Number(rubricAssessmentsCount.count),
				totalExpectedRubricAssessments,
			),
			total: totalExpectedRubricAssessments,
		},
	};
}

export async function loadAssessmentCompletionSummary(
	{ projectId }: { projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<AssessmentCompletionSummary> {
	"use cache";
	cacheTags(...assessmentCompletionSummaryCacheTags());
	cacheLife("projection");

	return loadAssessmentCompletionSummaryFromDb(db, { projectId });
}
