import "server-only";
import { snakeCase } from "change-case";
import type { Kysely } from "kysely";
import { revalidateTag } from "next/cache";
import { saveAssessmentInDb } from "#assessments/assessmentMutations.ts";
import type { AssessmentRubricValue } from "#assessments/types.ts";
import { CACHE_TAGS } from "#db/cacheTags.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import type { RubricType } from "#rubrics/types.ts";
import type { ImportedAssessmentRow } from "./types.ts";

const SUBMISSION_TYPE_COLUMN = snakeCase("submissionType");
const SUBMITTER_COLUMN = snakeCase("submitter");
const GRAND_TOTAL_MARKS_COLUMN = snakeCase("grandTotalMarks");

type ImportedRubricInfo = {
	id: string;
	type: RubricType;
	questionId: string;
	ordinalLabels: string[];
};

type PreparedAssessment = {
	submissionId: string;
	questionId: string;
	rubric: AssessmentRubricValue;
};

function assertRecognizedAssessmentColumns(params: {
	rows: ImportedAssessmentRow[];
	recognizedColumns: Set<string>;
}): void {
	if (params.rows.length === 0) {
		return;
	}

	const firstRow = params.rows[0];
	if (firstRow == null) {
		throw new Error("First row of assessment data is null or undefined.");
	}
	const headerColumns = Object.keys(firstRow);
	for (const column of headerColumns) {
		if (!params.recognizedColumns.has(column)) {
			throw new Error(`Unrecognized column: "${column}"`);
		}
	}
}

function submissionLookupKey(params: {
	submissionType: "team" | "individual";
	submitter: string;
}): string {
	return `${params.submissionType}:${params.submitter}`;
}

async function resolveSubmissionIdsBatch(
	db: Kysely<DB>,
	params: { rows: ImportedAssessmentRow[]; projectId: number },
): Promise<Map<string, string | null | "ambiguous">> {
	const teamSubmitters = new Set<string>();
	const individualSubmitters = new Set<string>();

	for (const row of params.rows) {
		if (row.submission_type === "team") {
			teamSubmitters.add(row.submitter);
		} else {
			individualSubmitters.add(row.submitter);
		}
	}

	const [teamSubmissions, individualSubmissions] = await Promise.all([
		teamSubmitters.size > 0
			? db
					.selectFrom("submission")
					.innerJoin("team", "team.id", "submission.teamId")
					.where("submission.type", "=", "team")
					.where("submission.projectId", "=", params.projectId)
					.where("team.name", "in", Array.from(teamSubmitters))
					.select(["team.name as submitter", "submission.id as submissionId"])
					.execute()
			: Promise.resolve([]),
		individualSubmitters.size > 0
			? db
					.selectFrom("submission")
					.innerJoin("student", "student.rowId", "submission.studentId")
					.where("submission.type", "=", "individual")
					.where("submission.projectId", "=", params.projectId)
					.where("student.id", "in", Array.from(individualSubmitters))
					.select(["student.id as submitter", "submission.id as submissionId"])
					.execute()
			: Promise.resolve([]),
	]);

	const submissionIdsByKey = new Map<string, Set<string>>();
	const resolvedByKey = new Map<string, string | null | "ambiguous">();

	for (const row of params.rows) {
		resolvedByKey.set(
			submissionLookupKey({
				submissionType: row.submission_type,
				submitter: row.submitter,
			}),
			null,
		);
	}

	for (const submission of teamSubmissions) {
		const key = submissionLookupKey({
			submissionType: "team",
			submitter: submission.submitter,
		});
		const existing = submissionIdsByKey.get(key);
		if (existing) {
			existing.add(String(submission.submissionId));
			continue;
		}

		submissionIdsByKey.set(key, new Set([String(submission.submissionId)]));
	}

	for (const submission of individualSubmissions) {
		const key = submissionLookupKey({
			submissionType: "individual",
			submitter: submission.submitter,
		});
		const existing = submissionIdsByKey.get(key);
		if (existing) {
			existing.add(String(submission.submissionId));
			continue;
		}

		submissionIdsByKey.set(key, new Set([String(submission.submissionId)]));
	}

	for (const [key, submissionIds] of submissionIdsByKey.entries()) {
		if (submissionIds.size > 1) {
			resolvedByKey.set(key, "ambiguous");
			continue;
		}

		const submissionId = submissionIds.values().next().value;
		if (submissionId != null) {
			resolvedByKey.set(key, submissionId);
		}
	}

	return resolvedByKey;
}

function parseAssessmentValue(params: {
	value: string;
	rubricInfo: ImportedRubricInfo;
}): AssessmentRubricValue {
	const { value, rubricInfo } = params;

	switch (rubricInfo.type) {
		case "boolean": {
			const normalizedValue = value.toLowerCase();
			if (normalizedValue !== "true" && normalizedValue !== "false") {
				throw new Error(`Invalid boolean value "${value}"`);
			}

			return {
				rubricId: rubricInfo.id,
				type: "boolean",
				passed: normalizedValue === "true",
			};
		}
		case "ordinal": {
			if (rubricInfo.ordinalLabels.length > 0) {
				const labelExists = rubricInfo.ordinalLabels.includes(value);
				if (!labelExists) {
					throw new Error(
						`Invalid ordinal value "${value}" for rubric ${rubricInfo.id}`,
					);
				}
			}

			return { rubricId: rubricInfo.id, type: "ordinal", selectedLabel: value };
		}
		case "numerical": {
			const score = parseFloat(value);
			if (Number.isNaN(score)) {
				throw new Error(`Invalid numerical value "${value}"`);
			}

			return { rubricId: rubricInfo.id, type: "numerical", score };
		}
		default: {
			throw new Error(`Unknown rubric type: ${rubricInfo.type}`);
		}
	}
}

// `db` may be the global client or a caller-supplied transaction. Performs all
// validation and persistence on that handle. It never opens a transaction and
// never invalidates cache.
export async function saveAssessmentsInDb(
	db: Kysely<DB>,
	{ rows, projectId }: { rows: ImportedAssessmentRow[]; projectId: string },
): Promise<{ assessmentCount: number }> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const [rubrics, questions] = await Promise.all([
		db
			.selectFrom("rubric")
			.innerJoin("question", "question.rowId", "rubric.questionId")
			.leftJoin("booleanRubric", "booleanRubric.rubricId", "rubric.rowId")
			.leftJoin("ordinalRubric", "ordinalRubric.rubricId", "rubric.rowId")
			.leftJoin(
				"ordinalRubricValue",
				"ordinalRubricValue.ordinalRubricId",
				"ordinalRubric.id",
			)
			.leftJoin("numericalRubric", "numericalRubric.rubricId", "rubric.rowId")
			.where("rubric.projectId", "=", projectRowId)
			.select([
				"rubric.id",
				"rubric.type",
				"question.id as questionId",
				"booleanRubric.marks",
				"ordinalRubricValue.label",
				"numericalRubric.minScore",
				"numericalRubric.maxScore",
			])
			.execute(),
		db
			.selectFrom("question")
			.where("question.projectId", "=", projectRowId)
			.select("id")
			.execute(),
	]);

	const rubricsByKey = new Map<string, ImportedRubricInfo>();

	for (const row of rubrics) {
		const key = `${row.questionId}:${row.id}`;
		const existing = rubricsByKey.get(key);

		if (!existing) {
			const ordinalLabels =
				row.type === "ordinal" && row.label ? [row.label] : [];
			rubricsByKey.set(key, {
				id: row.id,
				type: row.type,
				questionId: row.questionId,
				ordinalLabels,
			});
		} else if (
			row.type === "ordinal" &&
			row.label &&
			!existing.ordinalLabels.includes(row.label)
		) {
			existing.ordinalLabels.push(row.label);
		}
	}

	const recognizedColumns = new Set([
		SUBMISSION_TYPE_COLUMN,
		SUBMITTER_COLUMN,
		GRAND_TOTAL_MARKS_COLUMN,
	]);

	for (const [key] of rubricsByKey) {
		recognizedColumns.add(key);
		recognizedColumns.add(`${key}:marks`);
	}

	for (const question of questions) {
		recognizedColumns.add(question.id);
	}

	assertRecognizedAssessmentColumns({ rows, recognizedColumns });

	const errorDetails: Array<{
		row: number;
		submission: string;
		error: string;
	}> = [];
	const preparedAssessments: PreparedAssessment[] = [];
	const submissionsByLookup = await resolveSubmissionIdsBatch(db, {
		rows,
		projectId: projectRowId,
	});

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
		const row = rows[rowIndex];
		if (row == null) {
			throw new Error(
				`Row ${rowIndex + 2} of assessment data is null or undefined.`,
			);
		}
		const submissionType = row.submission_type;
		const submitter = row.submitter;
		const submissionId =
			submissionsByLookup.get(
				submissionLookupKey({ submissionType, submitter }),
			) ?? null;

		if (submissionId === "ambiguous") {
			errorDetails.push({
				row: rowIndex + 2,
				submission: submitter,
				error: `Ambiguous submission mapping for ${submissionType}:${submitter}`,
			});
			continue;
		}

		if (!submissionId) {
			continue;
		}

		for (const [columnKey, rubricInfo] of rubricsByKey) {
			const value = row[columnKey]?.trim();

			if (!value) {
				continue;
			}

			try {
				const assessment = parseAssessmentValue({ value, rubricInfo });

				preparedAssessments.push({
					submissionId,
					questionId: rubricInfo.questionId,
					rubric: assessment,
				});
			} catch (error) {
				errorDetails.push({
					row: rowIndex + 2,
					submission: submissionId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	if (errorDetails.length > 0) {
		const errorMessages = errorDetails
			.map((e) => `Row ${e.row} (${e.submission}): ${e.error}`)
			.join("\n");
		throw new Error(`Assessment import errors:\n${errorMessages}`);
	}

	let successCount = 0;

	for (const assessment of preparedAssessments) {
		const writeResult = await saveAssessmentInDb(db, assessment);

		if (!writeResult.success) {
			throw new Error(writeResult.error);
		}

		successCount++;
	}

	return { assessmentCount: successCount };
}

// Wrapper: owns the global db, the transaction boundary, and cache invalidation.
// `db` defaults to the global client; tests pass a test database. Never pass a
// transaction — the wrapper opens its own.
export async function saveAssessments(
	{ rows, projectId }: { rows: ImportedAssessmentRow[]; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ assessmentCount: number }> {
	const result = await db
		.transaction()
		.execute((tx) => saveAssessmentsInDb(tx, { rows, projectId }));

	// The transaction owner invalidates after commit. Safe only because this saver
	// always runs from assessmentsImportAction (request scope); revalidateTag throws
	// outside a request.
	revalidateTag(CACHE_TAGS.assessments, "max");
	revalidateTag(CACHE_TAGS.assessmentsAll, "max");

	return result;
}
