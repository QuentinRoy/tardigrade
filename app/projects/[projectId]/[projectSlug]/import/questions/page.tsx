import { Suspense } from "react";
import QuestionsImportForm from "#import/QuestionsImportForm.tsx";
import { questionsImportAction } from "#import/questionsImportAction.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";

type ProjectImportQuestionsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportQuestionsPage({
	params,
}: ProjectImportQuestionsPageProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	return (
		<Suspense>
			<QuestionsImportForm
				action={questionsImportAction.bind(null, project.id)}
			/>
		</Suspense>
	);
}
