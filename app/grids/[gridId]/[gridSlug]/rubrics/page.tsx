import { loadGridByPublicId } from "#grids/grids.ts";
import {
	deleteRubricAction,
	reorderRubricsAction,
	saveRubricAction,
} from "#rubric-management/actions.ts";
import RubricsManagementClient from "#rubric-management/RubricsManagementClient.tsx";
import { loadRubricDefinitions } from "#rubric-management/rubricDefinitions.ts";

type GridRubricsPageProps = {
	params: Promise<{ gridId: string; gridSlug: string }>;
};

export default async function GridRubricsPage({
	params,
}: GridRubricsPageProps) {
	const { gridId } = await params;
	const grid = await loadGridByPublicId(gridId, { required: true });

	const rubrics = await loadRubricDefinitions({ gridId: grid.id });

	return (
		<RubricsManagementClient
			saveAction={saveRubricAction.bind(null, grid.id)}
			deleteAction={deleteRubricAction.bind(null, grid.id)}
			reorderAction={reorderRubricsAction.bind(null, grid.id)}
			rubrics={rubrics}
		/>
	);
}
