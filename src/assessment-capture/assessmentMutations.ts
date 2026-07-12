import "server-only";
import type { Kysely } from "kysely";
import {
	type SaveAssessmentParams,
	type SaveAssessmentResult,
	saveAssessmentInDb,
} from "#assessment-persistence/assessmentMutations.ts";
import { invalidateAssessmentSave } from "#db/cacheInvalidation.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";

// Saves a single assessment on the interactive path: owns the transaction and
// invalidates cache only after it commits. Bulk callers (the import path) own
// their own transaction and compose `saveAssessmentInDb` directly, then invalidate
// after commit themselves. Cache invalidation must never run inside an open
// transaction.
export async function saveAssessment(
	params: SaveAssessmentParams,
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<SaveAssessmentResult> {
	const result = await db
		.transaction()
		.execute((tx) => saveAssessmentInDb(tx, params));
	const { targetId, rubricId } = params;
	if (result.success) {
		invalidateAssessmentSave({ targetId, rubricId });
	}

	return result;
}
