export function projectBasePath(
  projectId: string,
  projectSlug: string,
): string {
  return `/projects/${projectId}/${projectSlug}`;
}

export function projectDashboardPath(
  projectId: string,
  projectSlug: string,
): string {
  return projectBasePath(projectId, projectSlug);
}

export function changeProjectPath(): string {
  return "/projects";
}

export function projectAssessmentsPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectBasePath(projectId, projectSlug)}/assessments`;
}

export function projectOverviewPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectAssessmentsPath(projectId, projectSlug)}/overview`;
}

export function projectAssessmentSubmissionPath(
  projectId: string,
  projectSlug: string,
  submissionId: string,
): string {
  return `${projectAssessmentsPath(projectId, projectSlug)}/submissions/${submissionId}`;
}

export function projectAssessmentSubmissionQuestionPath(
  projectId: string,
  projectSlug: string,
  submissionId: string,
  questionId: string,
): string {
  return `${projectAssessmentSubmissionPath(projectId, projectSlug, submissionId)}/questions/${questionId}`;
}

export function projectQuestionsPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectBasePath(projectId, projectSlug)}/questions`;
}

export function projectImportQuestionsPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectBasePath(projectId, projectSlug)}/import/questions`;
}

export function projectImportStudentsPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectBasePath(projectId, projectSlug)}/import/students`;
}

export function projectImportAssessmentsPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectBasePath(projectId, projectSlug)}/import/assessments`;
}

export function projectExportSubmissionsPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectBasePath(projectId, projectSlug)}/export/submissions`;
}

export function projectExportQuestionsPath(
  projectId: string,
  projectSlug: string,
): string {
  return `${projectBasePath(projectId, projectSlug)}/export/questions`;
}
