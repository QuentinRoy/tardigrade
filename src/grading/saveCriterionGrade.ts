"use server";

import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import {
	type SaveCriterionGradeParams,
	type SaveCriterionGradeResult,
	saveCriterionGradeErrors,
} from "#grade-persistence/gradeMutations.ts";
import { createLogger } from "#utils/logger.ts";
import { saveCriterionGrade as persistGrade } from "./gradeMutations.ts";

const logger = createLogger("grades");

// Catches infra/unexpected throws from the mutation (e.g. a dropped DB
// connection) so the client always gets a shaped, actionable result instead
// of an unhandled rejection. Domain failures already return actionable
// SaveCriterionGradeResult messages from persistGrade and never throw.
// This catch must stay here, not in gradeMutations.ts: the import path
// composes saveCriterionGradeInDb directly and depends on its throws propagating
// for transaction rollback.
export async function saveCriterionGrade(
	params: SaveCriterionGradeParams,
	options?: { db?: Kysely<Database> },
): Promise<SaveCriterionGradeResult> {
	try {
		return await persistGrade(params, options);
	} catch (error) {
		logger.error({ err: error }, "Unexpected error saving an grade");
		return { success: false, error: saveCriterionGradeErrors.unexpected };
	}
}
