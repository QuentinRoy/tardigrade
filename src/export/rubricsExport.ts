import { dump } from "js-yaml";
import type { Criterion } from "#criteria/types.ts";
import type { RubricsById } from "#rubrics/types.ts";

type ExportFormat = {
	rubrics: Array<{ id: string; label?: string; criteria: Criterion[] }>;
};

export function exportRubricsToYaml(rubrics: RubricsById): string {
	const exportData: ExportFormat = {
		rubrics: Object.entries(rubrics).map(([id, rubric]) => ({
			id,
			...(rubric.label != null && { label: rubric.label }),
			criteria: rubric.criteria,
		})),
	};

	return dump(exportData, {
		lineWidth: -1,
		quoteStyle: "double",
		noRefs: true,
	});
}
