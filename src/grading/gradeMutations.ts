import "server-only";
import type { Kysely } from "kysely";
import { invalidateGradeSave } from "#db/cacheInvalidation.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import {
	type SaveCriterionGradeParams,
	type SaveCriterionGradeResult,
	saveCriterionGradeInDb,
} from "#grade-persistence/gradeMutations.ts";

// Saves a single grade on the interactive path: owns the transaction and
// invalidates cache only after it commits. Bulk callers (the import path) own
// their own transaction and compose `saveCriterionGradeInDb` directly, then invalidate
// after commit themselves. Cache invalidation must never run inside an open
// transaction.
export async function saveCriterionGrade(
	params: SaveCriterionGradeParams,
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<SaveCriterionGradeResult> {
	const result = await db
		.transaction()
		.execute((tx) => saveCriterionGradeInDb(tx, params));
	const { targetId, rubricId } = params;
	if (result.success) {
		invalidateGradeSave({ targetId, rubricId });
	}

	return result;
}
