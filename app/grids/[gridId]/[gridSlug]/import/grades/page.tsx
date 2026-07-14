import { Suspense } from "react";
import { loadGridByPublicId } from "#grids/grids.ts";
import GradesImportForm from "#imports/grades/GradesImportForm.tsx";
import { gradesImportAction } from "#imports/grades/gradesImportAction.ts";

type GridImportGradesPageProps = {
	params: Promise<{ gridId: string; gridSlug: string }>;
};

export default async function GridImportGradesPage({
	params,
}: GridImportGradesPageProps) {
	const { gridId } = await params;
	const grid = await loadGridByPublicId(gridId, { required: true });

	return (
		<Suspense>
			<GradesImportForm action={gradesImportAction.bind(null, grid.id)} />
		</Suspense>
	);
}
