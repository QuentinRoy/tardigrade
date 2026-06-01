import "server-only";
import { assertNever } from "#utils/utils.ts";
import { assessmentCacheTag, CACHE_TAGS, cacheTags } from "./cacheTags.ts";
import { db } from "./kysely.ts";
import type { AssessmentRubricValue } from "./types.ts";

// Returns typed rubric values for a submission/question assessment.
export async function loadAssessment(
	submissionId: string,
	questionId: string,
): Promise<AssessmentRubricValue[]> {
	"use cache";
	// The granular tag refreshes on individual saves; "assessments:all" refreshes
	// on bulk imports, which only bust the coarse tag (see src/db/submissionProgress.ts).
	cacheTags(
		assessmentCacheTag(submissionId, questionId),
		CACHE_TAGS.assessmentsAll,
	);

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
