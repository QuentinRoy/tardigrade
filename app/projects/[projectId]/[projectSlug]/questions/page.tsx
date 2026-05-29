import { notFound, redirect } from "next/navigation";
import { loadProjectByPublicId } from "@/db/projects";
import { loadManagedQuestions } from "@/db/questions";
import { projectQuestionsPath } from "@/projects/routes";
import {
	deleteQuestionAction,
	reorderQuestionsAction,
	saveQuestionAction,
} from "@/questions/actions";
import QuestionsManagementClient from "@/questions/QuestionsManagementClient";

type ProjectQuestionsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectQuestionsPage({
	params,
}: ProjectQuestionsPageProps) {
	const { projectId, projectSlug } = await params;
	const project = await loadProjectByPublicId(projectId);

	if (project == null) {
		notFound();
	}

	if (project.slug !== projectSlug) {
		redirect(projectQuestionsPath(project.id, project.slug));
	}

	const questions = await loadManagedQuestions(project.id);

	return (
		<QuestionsManagementClient
			saveAction={saveQuestionAction.bind(null, project.id)}
			deleteAction={deleteQuestionAction.bind(null, project.id)}
			reorderAction={reorderQuestionsAction.bind(null, project.id)}
			questions={questions.map((question) => ({
				id: question.id,
				label: question.label,
				position: question.position,
				assessmentCount: question.assessmentCount,
				rubricCount: question.rubricCount,
				question: question.question,
			}))}
		/>
	);
}
