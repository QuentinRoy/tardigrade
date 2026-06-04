import "server-only";
import { cacheLife } from "next/cache";
import { CACHE_TAGS, cacheTags } from "#db/cacheTags.ts";
import { db } from "#db/kysely.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import { loadQuestionGrid } from "../questions/questions.ts";
import {
	buildRubricOverviewData,
	type RubricOverviewAssessmentRecord,
} from "./rubricOverviewBuilder.ts";

export async function loadRubricOverviewData(projectId: string) {
	"use cache";
	cacheTags(
		CACHE_TAGS.questions,
		CACHE_TAGS.submissions,
		CACHE_TAGS.assessments,
	);
	cacheLife({ revalidate: 60 });

	const assessmentQuery = db
		.selectFrom("rubricAssessment")
		.innerJoin("assessment", "assessment.id", "rubricAssessment.assessmentId")
		.innerJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId")
		.where(
			"assessment.projectId",
			"in",
			db.selectFrom("project").select("rowId").where("id", "=", projectId),
		);

	const [submissions, questionGrid, assessmentRecords] = await Promise.all([
		loadSubmissions(projectId),
		loadQuestionGrid(projectId),
		assessmentQuery
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
			.select([
				"assessment.submissionId as submissionId",
				"rubric.id as rubricId",
				"rubricAssessment.type as type",
				"booleanRubricAssessment.passed as passed",
				"ordinalRubricAssessment.selectedLabel as selectedLabel",
				"numericalRubricAssessment.score as score",
			])
			.execute(),
	]);

	return buildRubricOverviewData({
		submissions,
		questionGrid,
		assessmentRecords: assessmentRecords as RubricOverviewAssessmentRecord[],
	});
}
