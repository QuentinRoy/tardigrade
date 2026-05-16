import { notFound } from "next/navigation";
import { loadQuestion } from "@/db/questions";
import EditQuestionClient from "@/questions/EditQuestionClient";

type EditQuestionPageProps = {
  params: Promise<{ questionId: string }>;
};

export default async function EditQuestionPage({
  params,
}: EditQuestionPageProps) {
  const { questionId } = await params;
  const question = await loadQuestion(questionId);

  if (question == null) {
    notFound();
  }

  return <EditQuestionClient questionId={questionId} question={question} />;
}
