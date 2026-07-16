import { dump } from "js-yaml";
import { encodeCriterion } from "#criteria/criterionYaml.ts";
import type { RubricsById } from "#rubrics/types.ts";

type ExportFormat = {
	rubrics: Array<{
		id: string;
		label?: string;
		criteria: Record<string, unknown>[];
	}>;
};

export function exportRubricsToYaml(rubrics: RubricsById): string {
	const exportData: ExportFormat = {
		rubrics: Object.entries(rubrics).map(([id, rubric]) => ({
			id,
			...(rubric.label != null && { label: rubric.label }),
			criteria: rubric.criteria.map(encodeCriterion),
		})),
	};

	return dump(exportData, {
		lineWidth: -1,
		quoteStyle: "double",
		noRefs: true,
	});
}
