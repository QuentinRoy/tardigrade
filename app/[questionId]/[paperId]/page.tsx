import { notFound } from "next/navigation";
import loadPapers from "../../../src/loadPapers";
import type { Question } from "../../../src/loadQuestions";
import loadQuestions from "../../../src/loadQuestions";
import QuestionClientPage from "../../../src/QuestionClientPage";

type PageParams = {
  questionId: string;
  paperId: string;
};

type QuestionPaperPageProps = {
  params: Promise<PageParams>;
};

export async function generateStaticParams() {
  const grid = await loadQuestions();
  const papers = await loadPapers();

  return Object.keys(grid).flatMap((questionId) =>
    papers.map((paper) => ({ questionId, paperId: paper.id })),
  );
}

export default async function QuestionPaperPage({
  params,
}: QuestionPaperPageProps) {
  const { questionId, paperId } = await params;
  const grid = await loadQuestions();
  const papers = await loadPapers();

  const question = grid[questionId] as Question | undefined;
  const hasPaper = papers.some((paper) => paper.id === paperId);

  if (question == null || !hasPaper) {
    notFound();
  }

  return (
    <QuestionClientPage
      questionId={questionId}
      question={question}
      papers={papers}
      currentPaperId={paperId}
    />
  );
}
