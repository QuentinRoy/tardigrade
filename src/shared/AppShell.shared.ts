export const APP_SHELL_DRAWER_WIDTH = 280;

export type ProjectRouteContext = { projectId: string; projectSlug: string };

export function getProjectRouteContext(
	pathname: string,
): ProjectRouteContext | null {
	const segments = pathname.split("/").filter((segment) => segment.length > 0);
	if (
		segments[0] !== "projects" ||
		segments[1] == null ||
		segments[2] == null
	) {
		return null;
	}

	return { projectId: segments[1], projectSlug: segments[2] };
}

export function displayProjectName(projectSlug: string): string {
	return projectSlug
		.split("-")
		.filter((segment) => segment.length > 0)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}
