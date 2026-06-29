type ProjectRef = { projectId: string; projectSlug: string };

type ProjectSubmissionRef = ProjectRef & { submissionId: string };

type ProjectSubmissionQuestionRef = ProjectSubmissionRef & {
	questionId: string;
};

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

export function projectOverviewPath(project: ProjectRef): string {
	return `${projectAssessmentsPath(project)}/overview`;
}

export function projectAssessmentSubmissionPath({
	submissionId,
	...project
}: ProjectSubmissionRef): string {
	return `${projectAssessmentsPath(project)}/submissions/${submissionId}`;
}

export function projectAssessmentSubmissionQuestionPath({
	questionId,
	...submission
}: ProjectSubmissionQuestionRef): string {
	return `${projectAssessmentSubmissionPath(submission)}/questions/${questionId}`;
}

export function projectQuestionsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/questions`;
}

export function projectImportQuestionsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/import/questions`;
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

export function projectExportQuestionsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/export/questions`;
}
