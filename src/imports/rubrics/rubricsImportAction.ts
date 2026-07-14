"use server";

import { toImportErrorState } from "#imports/actionUtils.ts";
import type { ActionState } from "#utils/actionState.ts";
import { parseRubricsYaml } from "./parseRubrics.ts";
import { saveRubrics } from "./saveRubrics.ts";

export async function rubricsImportAction(
	gridId: string,
	_previousState: ActionState,
	formData: FormData,
): Promise<ActionState> {
	const rubricsYaml = String(formData.get("rubricsYaml") ?? "");

	try {
		const rubrics = parseRubricsYaml(rubricsYaml);
		const result = await saveRubrics({ rubrics, gridId });

		const kindChangeNote =
			result.kindChangedCriterionCount > 0
				? ` ${result.kindChangedCriterionCount} criterion kind(s) were changed.`
				: "";

		return {
			status: "success",
			message: `Imported ${result.rubricCount} rubrics and ${result.criterionCount} criteria. Existing records were updated in place.${kindChangeNote}`,
		};
	} catch (error) {
		return toImportErrorState(error);
	}
}
