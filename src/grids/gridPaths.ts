type GridRef = { gridId: string; gridSlug: string };

type GridGradeTargetRef = GridRef & { targetId: string; targetSlug: string };

type GridGradeTargetRubricRef = GridGradeTargetRef & { rubricId: string };

export function gridBasePath({ gridId, gridSlug }: GridRef): string {
	return `/grids/${gridId}/${gridSlug}`;
}

export function gridOverviewPath(grid: GridRef): string {
	return gridBasePath(grid);
}

export function changeGridPath(): string {
	return "/grids";
}

export function gridGradesPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/grades`;
}

export function gridResultsPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/results`;
}

export function gridGradeTargetPath({
	targetId,
	targetSlug,
	...grid
}: GridGradeTargetRef): string {
	return `${gridGradesPath(grid)}/${targetId}/${targetSlug}`;
}

export function gridGradeTargetRubricPath({
	rubricId,
	...target
}: GridGradeTargetRubricRef): string {
	return `${gridGradeTargetPath(target)}/rubrics/${rubricId}`;
}

export function gridRubricsPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/rubrics`;
}

export function gridImportRubricsPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/import/rubrics`;
}

export function gridImportStudentsPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/import/students`;
}

export function gridImportGradesPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/import/grades`;
}

export function gridExportGradesPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/export/grades`;
}

export function gridExportRubricsPath(grid: GridRef): string {
	return `${gridBasePath(grid)}/export/rubrics`;
}
