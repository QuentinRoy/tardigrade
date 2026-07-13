"use server";

import type { Kysely } from "kysely";
import {
	assessmentErrors,
	type SaveAssessmentParams,
	type SaveAssessmentResult,
} from "#assessment-persistence/assessmentMutations.ts";
import type { Database } from "#db/generated/database.ts";
import { createLogger } from "#utils/logger.ts";
import { saveAssessment as persistAssessment } from "./assessmentMutations.ts";

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
	options?: { db?: Kysely<Database> },
): Promise<SaveAssessmentResult> {
	try {
		return await persistAssessment(params, options);
	} catch (error) {
		logger.error({ err: error }, "Unexpected error saving an assessment");
		return { success: false, error: assessmentErrors.unexpected };
	}
}
