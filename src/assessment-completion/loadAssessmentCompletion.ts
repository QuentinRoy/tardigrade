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

// Question-scoped progress: saving a criterion for question Q busts
// `assessments:question:Q` (and the coarse aggregate), so progress for Q
// refreshes without busting other questions; the import tag covers bulk imports,
// and the list tags cover roster and definition changes.
export function assessedCriterionCountsBySubmissionCacheTags(
	questionId: string,
): string[] {
	return [
		submissionListCacheTag(),
		questionListCacheTag(),
		assessmentProgressForQuestionCacheTag(questionId),
		assessmentImportCacheTag(),
	];
}

export function assessmentCompletionRowsCacheTags(): string[] {
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
			.leftJoin("criterion", "criterion.questionId", "question.rowId")
			.select((eb) => [
				"question.id as id",
				eb.fn.count<number>("criterion.id").as("criterionCount"),
			])
			.groupBy("question.id")
			.execute(),
		db
			.selectFrom("assessment")
			.where("assessment.projectId", "in", projectRowIdQuery)
			.innerJoin("question", "question.rowId", "assessment.questionId")
			.leftJoin(
				"criterionAssessment",
				"criterionAssessment.assessmentId",
				"assessment.id",
			)
			.select((eb) => [
				"assessment.submissionId as submissionId",
				"question.id as questionId",
				eb.fn.count<number>("criterionAssessment.id").as("assessmentCount"),
			])
			.groupBy(["assessment.submissionId", "question.id"])
			.execute(),
	]);

	return {
		submissionIds: submissions.map((submission) => String(submission.id)),
		questions: questions.map((question) => ({
			id: question.id,
			criterionCount: Number(question.criterionCount),
		})),
		assessmentCounts: assessmentCounts.map((row) => ({
			submissionId: String(row.submissionId),
			questionId: row.questionId,
			assessmentCount: Number(row.assessmentCount),
		})),
	};
}

// Pure builder: per-submission completed/total counts from shared completion rows.
function buildCompletionBySubmission(
	rows: AssessmentCompletionInput,
): Record<string, CompletionMetric> {
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

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessmentCompletionBySubmissionFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<Record<string, CompletionMetric>> {
	const rows = await loadAssessmentCompletionRowsFromDb(db, { projectId });
	return buildCompletionBySubmission(rows);
}

// Canonical cached source for project-wide completion rows (Finding 8). Shared by
// `loadAssessmentCompletionBySubmission` and `loadAssessmentCompletionSummary`, so
// both projections compose one cache entry instead of each querying
// independently.
//
// `options` is forwarded to nothing further; it is the test-only `db` seam
// (ADR 0007 rules 13–14). Runtime callers omit it.
export async function loadAssessmentCompletionRows(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<AssessmentCompletionInput> {
	"use cache";
	cacheTags(...assessmentCompletionRowsCacheTags());
	cacheLife("projection");
	return loadAssessmentCompletionRowsFromDb(options?.db ?? defaultDb, {
		projectId,
	});
}

// Plain deriver: shares `loadAssessmentCompletionRows`' cache entry at runtime
// instead of owning a second cache entry for the same underlying data (ADR 0008
// rule 5). `options` is forwarded unchanged (ADR 0007 rule 14): never resolve a
// default here before forwarding, so an omitted `db` stays `undefined` and the
// call shares that wrapper's own no-argument cache entry.
export async function loadAssessmentCompletionBySubmission(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<Record<string, CompletionMetric>> {
	const rows = await loadAssessmentCompletionRows({ projectId }, options);
	return buildCompletionBySubmission(rows);
}

export type AssessedCriterionCounts = {
	totalCriteria: number;
	completedBySubmissionId: Map<string, number>;
};

// `db` may be the global client or a caller-supplied transaction. Counts only —
// does not load submission ids, so a caller that already has the project's
// submissions (for example a page that also renders the roster) can build the
// per-submission result from `buildAssessedCriterionCountsBySubmission` below
// instead of querying submissions twice (Finding 7).
export async function loadAssessedCriterionCountsFromDb(
	db: Kysely<DB>,
	{ questionId, projectId }: { questionId: string; projectId: string },
): Promise<AssessedCriterionCounts> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const [criterionCountRow, assessmentCounts] = await Promise.all([
		db
			.selectFrom("criterion")
			.where("criterion.projectId", "in", projectRowIdQuery)
			.innerJoin("question", "question.rowId", "criterion.questionId")
			.where("question.id", "=", questionId)
			.select((eb) => eb.fn.countAll<number>().as("count"))
			.executeTakeFirstOrThrow(),
		db
			.selectFrom("assessment")
			.where("assessment.projectId", "in", projectRowIdQuery)
			.innerJoin("question", "question.rowId", "assessment.questionId")
			.leftJoin(
				"criterionAssessment",
				"criterionAssessment.assessmentId",
				"assessment.id",
			)
			.where("question.id", "=", questionId)
			.select((eb) => [
				"assessment.submissionId as submissionId",
				eb.fn.count<number>("criterionAssessment.id").as("completed"),
			])
			.groupBy("assessment.submissionId")
			.execute(),
	]);

	return {
		totalCriteria: Number(criterionCountRow.count),
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
export async function loadAssessedCriterionCounts(
	{ questionId, projectId }: { questionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<AssessedCriterionCounts> {
	return loadAssessedCriterionCountsFromDb(db, { questionId, projectId });
}

// Pure builder: per-submission completed/total criterion counts for one question,
// from already-loaded submission ids plus the counts above.
export function buildAssessedCriterionCountsBySubmission(
	submissionIds: string[],
	{ totalCriteria, completedBySubmissionId }: AssessedCriterionCounts,
): Record<string, CompletionMetric> {
	return Object.fromEntries(
		submissionIds.map((submissionId) => {
			const completed = Math.min(
				completedBySubmissionId.get(submissionId) ?? 0,
				totalCriteria,
			);

			return [submissionId, { completed, total: totalCriteria }];
		}),
	);
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessedCriterionCountsBySubmissionFromDb(
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
		loadAssessedCriterionCountsFromDb(db, { questionId, projectId }),
	]);

	return buildAssessedCriterionCountsBySubmission(
		submissions.map((submission) => String(submission.id)),
		counts,
	);
}

export async function loadAssessedCriterionCountsBySubmission(
	{ questionId, projectId }: { questionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<Record<string, CompletionMetric>> {
	"use cache";
	cacheTags(...assessedCriterionCountsBySubmissionCacheTags(questionId));
	cacheLife("projection");

	return loadAssessedCriterionCountsBySubmissionFromDb(db, {
		questionId,
		projectId,
	});
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadCriterionAssessmentsCountFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<number> {
	const projectRowIdQuery = db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId);

	const row = await db
		.selectFrom("criterionAssessment")
		.innerJoin(
			"assessment",
			"assessment.id",
			"criterionAssessment.assessmentId",
		)
		.where("assessment.projectId", "in", projectRowIdQuery)
		.select((eb) => eb.fn.countAll<number>().as("count"))
		.executeTakeFirstOrThrow();

	return Number(row.count);
}

export function criterionAssessmentsCountCacheTags(): string[] {
	return [assessmentAggregateCacheTag()];
}

// Canonical cached source for the project-wide criterion-assessment count, so the
// uncached project dashboard page (`app/.../[projectSlug]/page.tsx`) doesn't run
// this query on every request even though completion rows are cached.
export async function loadCriterionAssessmentsCount(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<number> {
	"use cache";
	cacheTags(...criterionAssessmentsCountCacheTags());
	cacheLife("projection");
	return loadCriterionAssessmentsCountFromDb(options?.db ?? defaultDb, {
		projectId,
	});
}

// Pure builder: completion summary from shared completion rows plus the criterion
// assessment count.
function buildCompletionSummary(
	rows: AssessmentCompletionInput,
	criterionAssessmentsCount: number,
): AssessmentCompletionSummary {
	const completion = buildAssessmentCompletion(rows);

	const totalCriteriaInProject = rows.questions.reduce(
		(sum, question) => sum + question.criterionCount,
		0,
	);
	const totalExpectedCriterionAssessments =
		completion.totalSubmissions * totalCriteriaInProject;

	return {
		submissions: {
			completed: completion.completedSubmissions,
			total: completion.totalSubmissions,
		},
		questions: {
			completed: completion.completedQuestions,
			total: completion.totalQuestions,
		},
		criteria: {
			completed: Math.min(
				criterionAssessmentsCount,
				totalExpectedCriterionAssessments,
			),
			total: totalExpectedCriterionAssessments,
		},
	};
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessmentCompletionSummaryFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<AssessmentCompletionSummary> {
	const [rows, criterionAssessmentsCount] = await Promise.all([
		loadAssessmentCompletionRowsFromDb(db, { projectId }),
		loadCriterionAssessmentsCountFromDb(db, { projectId }),
	]);

	return buildCompletionSummary(rows, criterionAssessmentsCount);
}

// Plain deriver: shares `loadAssessmentCompletionRows`' cache entry at runtime
// instead of owning a second cache entry for the same underlying data (ADR 0008
// rule 5). `options` is forwarded unchanged (ADR 0007 rule 14): never resolve a
// default here before forwarding, so an omitted `db` stays `undefined` and the
// call shares that wrapper's own no-argument cache entry.
export async function loadAssessmentCompletionSummary(
	{ projectId }: { projectId: string },
	options?: { db?: Kysely<DB> },
): Promise<AssessmentCompletionSummary> {
	const [rows, criterionAssessmentsCount] = await Promise.all([
		loadAssessmentCompletionRows({ projectId }, options),
		loadCriterionAssessmentsCount({ projectId }, options),
	]);

	return buildCompletionSummary(rows, criterionAssessmentsCount);
}
