import "server-only";
import { cacheLife } from "next/cache";
import { loadQuestions } from "@/db/questions";
import { CACHE_TAGS, cacheTags } from "./cacheTags";
import { db } from "./kysely";
import { withProjectScope } from "./projectScope";
import {
  buildRubricOverviewData,
  type RubricOverviewAssessmentRecord,
} from "./rubricOverviewBuilder";
import { loadSubmissions } from "./submissions";

export type {
  RubricOverviewData,
  RubricOverviewPopupDetails,
  RubricOverviewRow,
  RubricOverviewStudentCell,
  RubricOverviewStudentRow,
  RubricOverviewSummary,
} from "./rubricOverviewBuilder";

export async function loadRubricOverviewData(projectId?: number) {
  "use cache";
  cacheTags(
    CACHE_TAGS.questions,
    CACHE_TAGS.submissions,
    CACHE_TAGS.assessments,
  );
  cacheLife({ revalidate: 60 });

  let assessmentQuery = db
    .selectFrom("rubricAssessment")
    .innerJoin("assessment", "assessment.id", "rubricAssessment.assessmentId")
    .innerJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId");

  assessmentQuery = withProjectScope(assessmentQuery, projectId, (query, id) =>
    query.where("assessment.projectId", "=", id),
  );

  const [submissions, questionGrid, assessmentRecords] = await Promise.all([
    loadSubmissions(projectId),
    loadQuestions(projectId),
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
