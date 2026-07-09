import yaml from "js-yaml";
import type { Criterion } from "#criteria/types.ts";
import type { Grid } from "#questions/types.ts";

type ExportFormat = {
	questions: Array<{ id: string; label?: string; criteria: Criterion[] }>;
};

export function exportQuestionsToYaml(questions: Grid): string {
	const exportData: ExportFormat = {
		questions: Object.entries(questions).map(([id, question]) => ({
			id,
			...(question.label != null && { label: question.label }),
			criteria: question.criteria,
		})),
	};

	return yaml.dump(exportData, {
		lineWidth: -1,
		quotingType: '"',
		noRefs: true,
	});
}
