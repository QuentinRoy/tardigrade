type ProjectRef = { projectId: string; projectSlug: string };

type ProjectSubmissionRef = ProjectRef & { submissionId: string };

type ProjectSubmissionRubricRef = ProjectSubmissionRef & { rubricId: string };

export function projectBasePath({
	projectId,
	projectSlug,
}: ProjectRef): string {
	return `/projects/${projectId}/${projectSlug}`;
}

export function projectDashboardPath(project: ProjectRef): string {
	return projectBasePath(project);
}

export function changeProjectPath(): string {
	return "/projects";
}

export function projectAssessmentsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/assessments`;
}

export function projectResultsPath(project: ProjectRef): string {
	return `${projectAssessmentsPath(project)}/results`;
}

export function projectAssessmentSubmissionPath({
	submissionId,
	...project
}: ProjectSubmissionRef): string {
	return `${projectAssessmentsPath(project)}/submissions/${submissionId}`;
}

export function projectAssessmentSubmissionRubricPath({
	rubricId,
	...submission
}: ProjectSubmissionRubricRef): string {
	return `${projectAssessmentSubmissionPath(submission)}/rubrics/${rubricId}`;
}

export function projectRubricsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/rubrics`;
}

export function projectImportRubricsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/import/rubrics`;
}

export function projectImportStudentsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/import/students`;
}

export function projectImportAssessmentsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/import/assessments`;
}

export function projectExportSubmissionsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/export/submissions`;
}

export function projectExportRubricsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/export/rubrics`;
}
