import { Suspense } from "react";
import RubricsImportForm from "#imports/rubrics/RubricsImportForm.tsx";
import { rubricsImportAction } from "#imports/rubrics/rubricsImportAction.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";

type ProjectImportRubricsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportRubricsPage({
	params,
}: ProjectImportRubricsPageProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	return (
		<Suspense>
			<RubricsImportForm action={rubricsImportAction.bind(null, project.id)} />
		</Suspense>
	);
}
