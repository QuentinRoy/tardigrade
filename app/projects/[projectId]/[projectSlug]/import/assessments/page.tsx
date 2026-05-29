import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loadProjectByPublicId } from "@/db/projects";
import AssessmentsImportForm from "@/import/AssessmentsImportForm";
import { assessmentsImportAction } from "@/import/assessmentsImportAction";
import { projectImportAssessmentsPath } from "@/projects/routes";

type ProjectImportAssessmentsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportAssessmentsPage({
	params,
}: ProjectImportAssessmentsPageProps) {
	const { projectId, projectSlug } = await params;
	const project = await loadProjectByPublicId(projectId);

	if (project == null) {
		notFound();
	}

	if (project.slug !== projectSlug) {
		redirect(projectImportAssessmentsPath(project.id, project.slug));
	}

	return (
		<Suspense>
			<AssessmentsImportForm
				action={assessmentsImportAction.bind(null, project.id)}
			/>
		</Suspense>
	);
}
