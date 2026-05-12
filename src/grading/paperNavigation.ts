export type PaperNavigation<TPaper extends { id: string }> = {
  currentPaperIndex: number;
  currentPaper: TPaper | undefined;
  previousPaper: TPaper | undefined;
  nextPaper: TPaper | undefined;
};

export function getPaperNavigation<TPaper extends { id: string }>(
  papers: TPaper[],
  currentPaperId: string,
): PaperNavigation<TPaper> {
  const currentPaperIndex = papers.findIndex(
    (paper) => paper.id === currentPaperId,
  );
  const currentPaper =
    currentPaperIndex === -1 ? undefined : papers[currentPaperIndex];
  const previousPaper =
    currentPaperIndex > 0 ? papers[currentPaperIndex - 1] : undefined;
  const nextPaper =
    currentPaperIndex >= 0 && currentPaperIndex < papers.length - 1
      ? papers[currentPaperIndex + 1]
      : undefined;

  return { currentPaperIndex, currentPaper, previousPaper, nextPaper };
}
