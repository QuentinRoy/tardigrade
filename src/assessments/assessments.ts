import "server-only";
import type { Kysely } from "kysely";
import { assessmentCacheTag, CACHE_TAGS, cacheTags } from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { assertNever } from "#utils/utils.ts";
import type { AssessmentRubricValue } from "./types.ts";

// The granular tag refreshes on individual saves; "assessments:all" refreshes
// on bulk imports, which only bust the coarse tag (see submissionProgress.ts).
export function loadAssessmentCacheTags(
	submissionId: string,
	questionId: string,
): string[] {
	return [
		assessmentCacheTag(submissionId, questionId),
		CACHE_TAGS.assessmentsAll,
	];
}

// Returns typed rubric values for a submission/question assessment.
export async function loadAssessment(
	{ submissionId, questionId }: { submissionId: string; questionId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<AssessmentRubricValue[]> {
	"use cache";
	cacheTags(...loadAssessmentCacheTags(submissionId, questionId));

	return loadAssessmentFromDb(db, { submissionId, questionId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadAssessmentFromDb(
	db: Kysely<DB>,
	{ submissionId, questionId }: { submissionId: string; questionId: string },
): Promise<AssessmentRubricValue[]> {
	const assessment = await db
		.selectFrom("assessment")
		.innerJoin("submission", "submission.id", "assessment.submissionId")
		.innerJoin("question", "question.rowId", "assessment.questionId")
		.where("submission.id", "=", Number(submissionId))
		.where("question.id", "=", questionId)
		.whereRef("question.projectId", "=", "submission.projectId")
		.select("assessment.id as id")
		.executeTakeFirst();

	if (!assessment) {
		return [];
	}

	const rubricAssessments = await db
		.selectFrom("rubricAssessment")
		.innerJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId")
		.leftJoin(
			"booleanRubricAssessment",
			"booleanRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.leftJoin(
			"ordinalRubricAssessment",
			"ordinalRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.leftJoin(
			"numericalRubricAssessment",
			"numericalRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.where("rubricAssessment.assessmentId", "=", assessment.id)
		.select([
			"rubric.id as rubricId",
			"rubricAssessment.type as type",
			"booleanRubricAssessment.passed as passed",
			"ordinalRubricAssessment.selectedLabel as selectedLabel",
			"numericalRubricAssessment.score as score",
		])
		.execute();

	const result: AssessmentRubricValue[] = [];

	for (const rubricAssessment of rubricAssessments) {
		switch (rubricAssessment.type) {
			case "boolean": {
				if (rubricAssessment.passed == null) {
					break;
				}

				result.push({
					rubricId: rubricAssessment.rubricId,
					type: "boolean",
					passed: rubricAssessment.passed,
				});
				break;
			}
			case "ordinal": {
				if (rubricAssessment.selectedLabel == null) {
					break;
				}

				result.push({
					rubricId: rubricAssessment.rubricId,
					type: "ordinal",
					selectedLabel: rubricAssessment.selectedLabel,
				});
				break;
			}
			case "numerical": {
				if (rubricAssessment.score == null) {
					break;
				}

				result.push({
					rubricId: rubricAssessment.rubricId,
					type: "numerical",
					score:
						typeof rubricAssessment.score === "number"
							? rubricAssessment.score
							: parseFloat(String(rubricAssessment.score)),
				});
				break;
			}
			default: {
				assertNever(rubricAssessment.type);
			}
		}
	}

	return result;
}
