import { redirect } from "next/navigation";
import { gridDashboardPath } from "#grids/gridPaths.ts";
import { loadGrids } from "#grids/grids.ts";

export default async function HomePage() {
	const grids = await loadGrids();
	const defaultGrid = grids[0];

	if (defaultGrid == null) {
		redirect("/grids");
	}

	redirect(
		gridDashboardPath({ gridId: defaultGrid.id, gridSlug: defaultGrid.slug }),
	);
}
