type ProjectRef = { projectId: string; projectSlug: string };

type ProjectGradeTargetRef = ProjectRef & {
	targetId: string;
	targetSlug: string;
};

type ProjectGradeTargetRubricRef = ProjectGradeTargetRef & { rubricId: string };

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

export function projectGradesPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/grades`;
}

export function projectResultsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/results`;
}

export function projectGradeTargetPath({
	targetId,
	targetSlug,
	...project
}: ProjectGradeTargetRef): string {
	return `${projectGradesPath(project)}/${targetId}/${targetSlug}`;
}

export function projectGradeTargetRubricPath({
	rubricId,
	...target
}: ProjectGradeTargetRubricRef): string {
	return `${projectGradeTargetPath(target)}/rubrics/${rubricId}`;
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

export function projectExportGradesPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/export/grades`;
}

export function projectExportRubricsPath(project: ProjectRef): string {
	return `${projectBasePath(project)}/export/rubrics`;
}
