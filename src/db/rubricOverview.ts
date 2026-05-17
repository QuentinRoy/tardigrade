import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { loadQuestions } from "@/db/questions";
import { db } from "./kysely";
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

export async function loadRubricOverviewData() {
  "use cache";
  cacheTag("questions");
  cacheTag("submissions");
  cacheTag("assessments");
  cacheLife({ revalidate: 60 });

  const [submissions, questionGrid, assessmentRecords] = await Promise.all([
    loadSubmissions(),
    loadQuestions(),
    db
      .selectFrom("rubricAssessment")
      .innerJoin("assessment", "assessment.id", "rubricAssessment.assessmentId")
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
        "rubricAssessment.rubricId as rubricId",
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
