export const APP_SHELL_DRAWER_WIDTH = 280;

export type GridRouteContext = { gridId: string; gridSlug: string };

export function getGridRouteContext(pathname: string): GridRouteContext | null {
	const segments = pathname.split("/").filter((segment) => segment.length > 0);
	if (segments[0] !== "grids" || segments[1] == null || segments[2] == null) {
		return null;
	}

	return { gridId: segments[1], gridSlug: segments[2] };
}
