import { notFound, redirect } from "next/navigation";
import loadPapers from "../../src/loadPapers";
import type { Question } from "../../src/loadQuestions";
import loadQuestions from "../../src/loadQuestions";

type PageParams = {
  questionId: string;
};

type QuestionPageProps = {
  params: Promise<PageParams>;
};

export async function generateStaticParams() {
  const grid = await loadQuestions();
  return Object.keys(grid).map((questionId) => ({ questionId }));
}

export default async function QuestionPage({ params }: QuestionPageProps) {
  const { questionId } = await params;
  const grid = await loadQuestions();
  const papers = await loadPapers();
  const question = grid[questionId] as Question | undefined;

  if (question == null) {
    notFound();
  }

  if (papers.length === 0) {
    notFound();
  }

  return redirect(`/${questionId}/${papers[0].id}`);
}
