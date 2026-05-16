import yaml from "js-yaml";
import type { Grid, Rubric } from "@/db/types";

type ExportFormat = {
  questions: Array<{
    id: string;
    label?: string;
    rubrics: Rubric[];
  }>;
};

export function exportQuestionsToYaml(questions: Grid): string {
  const exportData: ExportFormat = {
    questions: Object.entries(questions).map(([id, question]) => ({
      id,
      ...(question.label != null && { label: question.label }),
      rubrics: question.rubrics,
    })),
  };

  return yaml.dump(exportData, {
    lineWidth: -1,
    quotingType: '"',
    noRefs: true,
  });
}
