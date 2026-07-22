"use client";

import type { SaveError } from "#design-system/SaveErrorsProvider.tsx";
import type {
	SaveCriterionGradeParams,
	SaveCriterionGradeResult,
} from "#grade-persistence/gradeMutations.ts";
import { gradeUnreachableMessage } from "./saveCriterionGradeMessages.ts";
import type { SaveResult } from "./useGradingSession.ts";

// The saveCriterionGrade server action is injected rather than imported here, so
// this module never statically imports a "use server" file. Components pass
// the real action down from a server-rendered page (where Next.js's
// "use server" transform applies); stories pass a plain stub instead.
export type SaveCriterionGrade = (
	params: SaveCriterionGradeParams,
) => Promise<SaveCriterionGradeResult>;

export async function trySaveCriterionGrade({
	saveCriterionGrade,
	gridId,
	gradeTargetId,
	rubricId,
	grade,
	errorContext,
}: {
	saveCriterionGrade: SaveCriterionGrade;
	gridId: string;
	gradeTargetId: string;
	rubricId: string;
	grade: SaveCriterionGradeParams["grade"];
	errorContext: Omit<SaveError, "id" | "message">;
}): Promise<SaveResult<Omit<SaveError, "id">>> {
	try {
		const result = await saveCriterionGrade({
			gridId,
			gradeTargetId,
			rubricId,
			grade,
		});

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
			error: { ...errorContext, message: gradeUnreachableMessage },
		};
	}
}
