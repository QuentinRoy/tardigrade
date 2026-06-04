import { Suspense } from "react";
import StudentsImportForm from "#import/StudentsImportForm.tsx";
import { studentsImportAction } from "#import/studentsImportAction.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";

type ProjectImportStudentsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportStudentsPage({
	params,
}: ProjectImportStudentsPageProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	return (
		<Suspense>
			<StudentsImportForm
				action={studentsImportAction.bind(null, project.id)}
			/>
		</Suspense>
	);
}
