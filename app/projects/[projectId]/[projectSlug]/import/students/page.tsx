import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loadProjectByPublicId } from "@/db/projects";
import StudentsImportForm from "@/import/StudentsImportForm";
import { studentsImportAction } from "@/import/studentsImportAction";
import { projectImportStudentsPath } from "@/projects/routes";

type ProjectImportStudentsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportStudentsPage({
	params,
}: ProjectImportStudentsPageProps) {
	const { projectId, projectSlug } = await params;
	const project = await loadProjectByPublicId(projectId);

	if (project == null) {
		notFound();
	}

	if (project.slug !== projectSlug) {
		redirect(projectImportStudentsPath(project.id, project.slug));
	}

	return (
		<Suspense>
			<StudentsImportForm
				action={studentsImportAction.bind(null, project.id)}
			/>
		</Suspense>
	);
}
