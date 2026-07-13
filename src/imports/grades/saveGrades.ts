import "server-only";
import type { Kysely } from "kysely";
import { invalidateGradeImport } from "#db/cacheInvalidation.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { saveCriterionGradeInDb } from "#grade-persistence/gradeMutations.ts";
import { ImportBlockedError } from "#imports/importErrors.ts";
import type { ImportedGradeRow } from "#imports/types.ts";
import { loadGradeImportContextFromDb } from "./gradeImportContext.ts";
import {
	type GradeImportBlockingDiagnostic,
	type GradeImportPlan,
	prepareGradeImport,
} from "./prepareGradeImport.ts";

function formatBlockingDiagnostic(
	diagnostic: GradeImportBlockingDiagnostic,
): string {
	switch (diagnostic.type) {
		case "unknown-column": {
			return `Unrecognized column: "${diagnostic.column}"`;
		}
		case "unmatched-target": {
			return `Row ${diagnostic.row} (${diagnostic.name}): No matching ${diagnostic.targetKind} student or group for "${diagnostic.name}"`;
		}
		case "ambiguous-target": {
			return `Row ${diagnostic.row} (${diagnostic.name}): Multiple ${diagnostic.targetKind} students or groups match "${diagnostic.name}"`;
		}
		case "invalid-value": {
			return `Row ${diagnostic.row} (${diagnostic.name}): ${diagnostic.message} in column "${diagnostic.column}"`;
		}
		case "no-grade-columns": {
			return "No grade columns found in this file. Nothing would be imported.";
		}
	}
}

function gradeImportBlockedError(
	blockingDiagnostics: GradeImportBlockingDiagnostic[],
): ImportBlockedError {
	const lines = blockingDiagnostics.map(formatBlockingDiagnostic);

	return new ImportBlockedError(
		`Grade import errors:\n${lines.join("\n")}\nNothing was imported. Fix the listed issues and retry.`,
	);
}

// `db` may be the global client or a caller-supplied transaction. Executes a
// plan's writes; never opens a transaction and never invalidates cache.
export async function saveGradeImportPlanInDb(
	db: Kysely<Database>,
	plan: GradeImportPlan,
	{ projectId }: { projectId: string },
): Promise<void> {
	for (const write of plan.writes) {
		const result = await saveCriterionGradeInDb(db, { ...write, projectId });

		if (!result.success) {
			throw new Error(result.error);
		}
	}
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveGrades(
	{ rows, projectId }: { rows: ImportedGradeRow[]; projectId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<{ gradeCount: number; overwriteCount: number }> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadGradeImportContextFromDb(tx, { rows, projectId });
		const plan = prepareGradeImport({ rows, context });

		if (plan.blockingDiagnostics.length > 0) {
			throw gradeImportBlockedError(plan.blockingDiagnostics);
		}

		await saveGradeImportPlanInDb(tx, plan, { projectId });

		return {
			gradeCount: plan.writes.length,
			overwriteCount: plan.overwrites.length,
		};
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from gradesImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateGradeImport();

	return result;
}
