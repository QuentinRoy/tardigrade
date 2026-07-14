import { Suspense } from "react";
import { loadGridByPublicId } from "#grids/grids.ts";
import RubricsImportForm from "#imports/rubrics/RubricsImportForm.tsx";
import { rubricsImportAction } from "#imports/rubrics/rubricsImportAction.ts";

type GridImportRubricsPageProps = {
	params: Promise<{ gridId: string; gridSlug: string }>;
};

export default async function GridImportRubricsPage({
	params,
}: GridImportRubricsPageProps) {
	const { gridId } = await params;
	const grid = await loadGridByPublicId(gridId, { required: true });

	return (
		<Suspense>
			<RubricsImportForm action={rubricsImportAction.bind(null, grid.id)} />
		</Suspense>
	);
}
