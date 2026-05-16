import { loadManagedQuestions } from "@/db/questions";
import QuestionsManagementClient from "@/questions/QuestionsManagementClient";

export default async function QuestionsPage() {
  const questions = await loadManagedQuestions();

  return (
    <QuestionsManagementClient
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
