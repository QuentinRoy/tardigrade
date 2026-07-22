import "server-only";
import type { Kysely, Transaction } from "kysely";
import { invalidateGradeImport } from "#db/cacheInvalidation.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { saveCriterionGradesInDb } from "#grade-persistence/gradeMutations.ts";
import { ImportBlockedError } from "#imports/importErrors.ts";
import type { ImportedGradeRow } from "#imports/types.ts";
import { chunk } from "#utils/utils.ts";
import { loadGradeImportContextFromDb } from "./gradeImportContext.ts";
import {
	type GradeImportBlockingDiagnostic,
	type GradeImportPlan,
	prepareGradeImport,
} from "./prepareGradeImport.ts";

// Bounds each write statement's parameter count well under Postgres's
// per-statement limit regardless of import size, while keeping the executor's
// round-trip count proportional to chunks and Criterion kinds rather than to
// the number of Grades.
export const GRADE_IMPORT_WRITE_CHUNK_SIZE = 500;

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
		case "duplicate-grade-cell": {
			return `Rows ${diagnostic.first.row}, column "${diagnostic.first.column}" and ${diagnostic.second.row}, column "${diagnostic.second.column}" both import a grade for the same student or group and criterion. Remove one of these values`;
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

// `db` is a caller-supplied transaction; this write primitive cannot run on
// the global client. Executes a plan's writes in bounded-size batches through
// the shared bulk persistence primitive, so an import's database work scales
// with the number of chunks and Criterion kinds rather than with one
// resolution/write sequence per Grade. Never opens a transaction and never
// invalidates cache.
export async function saveGradeImportPlanInDb(
	db: Transaction<Database>,
	plan: GradeImportPlan,
	{ gridId }: { gridId: string },
): Promise<void> {
	for (const writes of chunk(plan.writes, GRADE_IMPORT_WRITE_CHUNK_SIZE)) {
		const result = await saveCriterionGradesInDb(db, {
			gridId,
			grades: writes,
		});

		if (!result.success) {
			throw new Error(result.error);
		}
	}
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveGrades(
	{ rows, gridId }: { rows: ImportedGradeRow[]; gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<{ gradeCount: number; overwriteCount: number }> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadGradeImportContextFromDb(tx, { rows, gridId });
		const plan = prepareGradeImport({ rows, context });

		if (plan.blockingDiagnostics.length > 0) {
			throw gradeImportBlockedError(plan.blockingDiagnostics);
		}

		await saveGradeImportPlanInDb(tx, plan, { gridId });

		return {
			gradeCount: plan.writes.length,
			overwriteCount: plan.overwrites.length,
		};
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from gradesImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateGradeImport({ gridId });

	return result;
}
