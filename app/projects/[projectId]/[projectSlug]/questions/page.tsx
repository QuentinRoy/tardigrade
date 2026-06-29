import { loadProjectByPublicId } from "#projects/projects.ts";
import {
	deleteQuestionAction,
	reorderQuestionsAction,
	saveQuestionAction,
} from "#question-management/actions.ts";
import QuestionsManagementClient from "#question-management/QuestionsManagementClient.tsx";
import { loadQuestionDefinitions } from "#question-management/questionDefinitions.ts";

type ProjectQuestionsPageProps = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export default async function ProjectQuestionsPage({
	params,
}: ProjectQuestionsPageProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId, { required: true });

	const questions = await loadQuestionDefinitions({ projectId: project.id });

	return (
		<QuestionsManagementClient
			saveAction={saveQuestionAction.bind(null, project.id)}
			deleteAction={deleteQuestionAction.bind(null, project.id)}
			reorderAction={reorderQuestionsAction.bind(null, project.id)}
			questions={questions}
		/>
	);
}
