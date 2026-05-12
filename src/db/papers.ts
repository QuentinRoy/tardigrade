import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";
import type { Paper } from "./types";

async function loadPapersFromDb() {
  "use cache";
  cacheTag("papers");
  cacheLife({ revalidate: 60 });

  return prisma.paper.findMany({
    orderBy: { id: "asc" },
  });
}

export async function loadPapers(): Promise<Paper[]> {
  const papers = await loadPapersFromDb();

  return papers.map((paper) => ({
    id: paper.id,
    label: paper.label,
    team: paper.team ?? undefined,
  }));
}
