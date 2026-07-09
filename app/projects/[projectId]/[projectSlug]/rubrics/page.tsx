import { loadProjectByPublicId } from "#projects/projects.ts";
import {
	deleteRubricAction,
	reorderRubricsAction,
	saveRubricAction,
} from "#rubric-management/actions.ts";
import RubricsManagementClient from "#rubric-management/RubricsManagementClient.tsx";
import { loadRubricDefinitions } from "#rubric-management/rubricDefinitions.ts";

type ProjectRubricsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectRubricsPage({
	params,
}: ProjectRubricsPageProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	const rubrics = await loadRubricDefinitions({ projectId: project.id });

	return (
		<RubricsManagementClient
			saveAction={saveRubricAction.bind(null, project.id)}
			deleteAction={deleteRubricAction.bind(null, project.id)}
			reorderAction={reorderRubricsAction.bind(null, project.id)}
			rubrics={rubrics}
		/>
	);
}
