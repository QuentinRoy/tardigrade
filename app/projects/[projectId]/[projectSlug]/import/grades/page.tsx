import { Suspense } from "react";
import GradesImportForm from "#imports/grades/GradesImportForm.tsx";
import { gradesImportAction } from "#imports/grades/gradesImportAction.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";

type ProjectImportGradesPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportGradesPage({
	params,
}: ProjectImportGradesPageProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	return (
		<Suspense>
			<GradesImportForm action={gradesImportAction.bind(null, project.id)} />
		</Suspense>
	);
}
