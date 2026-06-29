"use client";

import type {
	SaveAssessmentParams,
	SaveAssessmentResult,
} from "#assessment-persistence/assessmentMutations.ts";
import type { SaveError } from "#design-system/SaveErrorsProvider.tsx";
import { assessmentUnreachableMessage } from "./saveAssessmentMessages.ts";
import type { SaveRubricResult } from "./useAssessmentSession.ts";

// The saveAssessment server action is injected rather than imported here, so
// this module never statically imports a "use server" file. Components pass
// the real action down from a server-rendered page (where Next.js's
// "use server" transform applies); stories pass a plain stub instead.
export type SaveAssessment = (
	params: SaveAssessmentParams,
) => Promise<SaveAssessmentResult>;

export async function saveRubricAssessment({
	saveAssessment,
	submissionId,
	questionId,
	rubric,
	errorContext,
}: {
	saveAssessment: SaveAssessment;
	submissionId: string;
	questionId: string;
	rubric: SaveAssessmentParams["rubric"];
	errorContext: Omit<SaveError, "id" | "message">;
}): Promise<SaveRubricResult<Omit<SaveError, "id">>> {
	try {
		const result = await saveAssessment({ submissionId, questionId, rubric });

		if (result.success) {
			return { success: true };
		}
		return {
			success: false,
			error: { ...errorContext, message: result.error },
		};
	} catch {
		return {
			success: false,
			error: { ...errorContext, message: assessmentUnreachableMessage },
		};
	}
}
