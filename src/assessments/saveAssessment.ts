"use server";

import type { Kysely } from "kysely";
import {
	assessmentErrors,
	saveAssessment as persistAssessment,
	type SaveAssessmentParams,
	type SaveAssessmentResult,
} from "#assessments/assessmentMutations.ts";
import type { DB } from "#db/generated/db.ts";
import { createLogger } from "#utils/logger.ts";

const logger = createLogger("assessments");

// Catches infra/unexpected throws from the mutation (e.g. a dropped DB
// connection) so the client always gets a shaped, actionable result instead
// of an unhandled rejection. Domain failures already return actionable
// SaveAssessmentResult messages from persistAssessment and never throw.
// This catch must stay here, not in assessmentMutations.ts: the import path
// composes saveAssessmentInDb directly and depends on its throws propagating
// for transaction rollback.
export async function saveAssessment(
	params: SaveAssessmentParams,
	options?: { db?: Kysely<DB> },
): Promise<SaveAssessmentResult> {
	try {
		return await persistAssessment(params, options);
	} catch (error) {
		logger.error({ err: error }, "Unexpected error saving an assessment");
		return { success: false, error: assessmentErrors.unexpected };
	}
}
