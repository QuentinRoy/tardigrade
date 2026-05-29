import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadProjectByPublicId } from "@/db/projects";
import QuestionsImportForm from "@/import/QuestionsImportForm";
import { questionsImportAction } from "@/import/questionsImportAction";
import { projectImportQuestionsPath } from "@/projects/projectPaths";

type ProjectImportQuestionsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectImportQuestionsPage({
	params,
}: ProjectImportQuestionsPageProps) {
  const { projectId, projectSlug } = await params;
  const project = await loadProjectByPublicId(projectId, { required: true });

	if (project.slug !== projectSlug) {
		redirect(projectImportQuestionsPath(project.id, project.slug));
	}

	return (
		<Suspense>
			<QuestionsImportForm
				action={questionsImportAction.bind(null, project.id)}
			/>
		</Suspense>
	);
}
