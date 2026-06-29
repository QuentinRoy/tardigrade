import "server-only";
import type { Kysely } from "kysely";
import { saveAssessmentInDb } from "#assessment-capture/assessmentMutations.ts";
import { invalidateAssessmentImport } from "#db/cacheInvalidation.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { loadAssessmentImportContextFromDb } from "./assessmentImportContext.ts";
import { ImportBlockedError } from "./importErrors.ts";
import {
	type AssessmentImportBlockingDiagnostic,
	type AssessmentImportPlan,
	prepareAssessmentImport,
} from "./prepareAssessmentImport.ts";
import type { ImportedAssessmentRow } from "./types.ts";

function formatBlockingDiagnostic(
	diagnostic: AssessmentImportBlockingDiagnostic,
): string {
	switch (diagnostic.type) {
		case "unknown-column": {
			return `Unrecognized column: "${diagnostic.column}"`;
		}
		case "unmatched-submission": {
			return `Row ${diagnostic.row} (${diagnostic.submitter}): No matching ${diagnostic.submissionType} submission for "${diagnostic.submitter}"`;
		}
		case "ambiguous-submission": {
			return `Row ${diagnostic.row} (${diagnostic.submitter}): Multiple ${diagnostic.submissionType} submissions match "${diagnostic.submitter}"`;
		}
		case "invalid-value": {
			return `Row ${diagnostic.row} (${diagnostic.submitter}): ${diagnostic.message} in column "${diagnostic.column}"`;
		}
		case "no-assessment-columns": {
			return "No assessment columns found in this file. Nothing would be imported.";
		}
	}
}

function assessmentImportBlockedError(
	blockingDiagnostics: AssessmentImportBlockingDiagnostic[],
): ImportBlockedError {
	const lines = blockingDiagnostics.map(formatBlockingDiagnostic);

	return new ImportBlockedError(
		`Assessment import errors:\n${lines.join("\n")}\nNothing was imported. Fix the listed issues and retry.`,
	);
}

// `db` may be the global client or a caller-supplied transaction. Executes a
// plan's writes; never opens a transaction and never invalidates cache.
export async function saveAssessmentImportPlanInDb(
	db: Kysely<DB>,
	plan: AssessmentImportPlan,
): Promise<void> {
	for (const write of plan.writes) {
		const result = await saveAssessmentInDb(db, write);

		if (!result.success) {
			throw new Error(result.error);
		}
	}
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveAssessments(
	{ rows, projectId }: { rows: ImportedAssessmentRow[]; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ assessmentCount: number; overwriteCount: number }> {
	const result = await db.transaction().execute(async (tx) => {
		const context = await loadAssessmentImportContextFromDb(tx, {
			rows,
			projectId,
		});
		const plan = prepareAssessmentImport({ rows, context });

		if (plan.blockingDiagnostics.length > 0) {
			throw assessmentImportBlockedError(plan.blockingDiagnostics);
		}

		await saveAssessmentImportPlanInDb(tx, plan);

		return {
			assessmentCount: plan.writes.length,
			overwriteCount: plan.overwrites.length,
		};
	});

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from assessmentsImportAction (request scope); the helper's
	// revalidateTag calls throw outside a request.
	invalidateAssessmentImport();

	return result;
}
