import { Suspense } from "react";
import AssessmentsImportForm from "#import/AssessmentsImportForm.tsx";
import { assessmentsImportAction } from "#import/assessmentsImportAction.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";

type ProjectImportAssessmentsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportAssessmentsPage({
	params,
}: ProjectImportAssessmentsPageProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	return (
		<Suspense>
			<AssessmentsImportForm
				action={assessmentsImportAction.bind(null, project.id)}
			/>
		</Suspense>
	);
}
