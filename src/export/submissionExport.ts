import "server-only";
import { once } from "node:events";
import { stringify } from "csv-stringify";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { loadQuestionRowsFromDb, toRubric } from "#questions/questions.ts";
import { attachAssessment, markRubric } from "#rubrics/rubric.ts";
import type { AssessedRubric, AssessmentRubricValue } from "#rubrics/types.ts";
import type { SubmissionSubmitter } from "#submissions/types.ts";
import { assertNever } from "#utils/utils.ts";
import {
	buildAssessmentKey,
	buildSubmissionExportHeaders,
	buildSubmissionExportRecord,
	type ExportOptions,
	type ExportQuestionPlan,
	type SubmissionExportAssessmentValue,
	type SubmissionExportDataRow,
	type SubmissionExportQuestionData,
	type SubmissionExportRecord,
	type SubmissionExportRubricData,
} from "./submissionExportCsv.ts";
import {
	groupSubmissionRows,
	type SubmissionGroup,
	type SubmissionRow,
} from "./submissionExportGrouping.ts";

function toSubmissionSubmitter(params: {
	id: string;
	type: "team" | "individual";
	teamName: string | null;
	studentId: string | null;
}): SubmissionSubmitter {
	if (params.type === "team") {
		if (params.teamName == null || params.teamName.length === 0) {
			throw new Error(
				`Submission ${params.id} has type team but no team is linked.`,
			);
		}

		return { id: params.id, type: "team", teamName: params.teamName };
	}

	if (params.studentId == null || params.studentId.length === 0) {
		throw new Error(
			`Submission ${params.id} has type individual but no student is linked.`,
		);
	}

	return { id: params.id, type: "individual", studentId: params.studentId };
}

async function assertSubmissionInvariantsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
) {
	const invalidSubmissions = await db
		.selectFrom("project")
		.where("project.id", "=", projectId)
		.leftJoin("submission", "project.rowId", "submission.projectId")
		.select((expressionBuilder) => expressionBuilder.fn.countAll().as("count"))
		.where((expressionBuilder) =>
			expressionBuilder.or([
				expressionBuilder.and([
					expressionBuilder("type", "=", "team"),
					expressionBuilder("teamId", "is", null),
				]),
				expressionBuilder.and([
					expressionBuilder("type", "=", "individual"),
					expressionBuilder("studentId", "is", null),
				]),
			]),
		)
		.executeTakeFirstOrThrow();

	const invalidCount = Number(invalidSubmissions.count);

	if (invalidCount > 0) {
		throw new Error(
			`Unexpected submission data: found ${invalidCount} submissions without required owner.`,
		);
	}
}

function streamSubmissionExportRowsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): AsyncIterable<SubmissionRow> {
	return db
		.selectFrom("project")
		.where("project.id", "=", projectId)
		.leftJoin("submission", "project.rowId", "submission.projectId")
		.leftJoin("team", "team.id", "submission.teamId")
		.leftJoin("student", "student.rowId", "submission.studentId")
		.leftJoin("assessment", "assessment.submissionId", "submission.id")
		.leftJoin("question", "question.rowId", "assessment.questionId")
		.leftJoin(
			"rubricAssessment",
			"rubricAssessment.assessmentId",
			"assessment.id",
		)
		.leftJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId")
		.leftJoin(
			"booleanRubricAssessment",
			"booleanRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.leftJoin(
			"ordinalRubricAssessment",
			"ordinalRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.leftJoin(
			"numericalRubricAssessment",
			"numericalRubricAssessment.rubricAssessmentId",
			"rubricAssessment.id",
		)
		.select([
			"submission.id as submissionId",
			"submission.type as submissionType",
			"team.name as teamName",
			"student.id as studentId",
			"question.id as questionId",
			"rubric.id as rubricId",
			"booleanRubricAssessment.passed as booleanPassed",
			"ordinalRubricAssessment.selectedLabel as ordinalSelectedLabel",
			"numericalRubricAssessment.score as numericalScore",
		])
		.orderBy("submission.id", "asc")
		.orderBy("assessment.id", "asc")
		.orderBy("rubricAssessment.id", "asc")
		.stream(200);
}

export async function createSubmissionExport(
	projectId: string,
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{
	questions: ExportQuestionPlan[];
	rows: AsyncGenerator<SubmissionExportDataRow>;
}> {
	await assertSubmissionInvariantsFromDb(db, { projectId });

	const questionRows = await loadQuestionRowsFromDb(db, { projectId });
	const questions: ExportQuestionPlan[] = questionRows.map((row) => ({
		id: row.id,
		rubrics: row.rubrics.map(toRubric),
	}));

	function getAssessmentValue(
		rubric: AssessedRubric,
	): SubmissionExportAssessmentValue | undefined {
		if (rubric.assessment == null) {
			return undefined;
		}

		switch (rubric.type) {
			case "boolean": {
				return rubric.assessment.passed;
			}
			case "ordinal": {
				return rubric.assessment.selectedLabel;
			}
			case "numerical": {
				return rubric.assessment.score;
			}
			default: {
				return assertNever(rubric);
			}
		}
	}

	function buildQuestionData(
		valuesByKey: Map<string, AssessmentRubricValue>,
	): SubmissionExportQuestionData[] {
		return questions.map((question) => ({
			questionId: question.id,
			rubrics: question.rubrics.map((rubric) => {
				const assessedRubric = attachAssessment(
					rubric,
					valuesByKey.get(buildAssessmentKey(question.id, rubric.id)),
				);

				const rowRubric: SubmissionExportRubricData = { rubricId: rubric.id };

				const assessment = getAssessmentValue(assessedRubric);
				if (assessment != null) {
					rowRubric.assessment = assessment;
				}

				if (assessedRubric.assessment != null) {
					rowRubric.marks = markRubric(assessedRubric);
				}

				return rowRubric;
			}),
		}));
	}

	function buildGroupExportRow(
		group: SubmissionGroup,
	): SubmissionExportDataRow {
		return {
			submission: toSubmissionSubmitter({
				id: String(group.submissionId),
				type: group.submissionType,
				teamName: group.teamName,
				studentId: group.studentId,
			}),
			questions: buildQuestionData(group.valuesByKey),
		};
	}

	async function* rows(): AsyncGenerator<SubmissionExportDataRow> {
		const stream = streamSubmissionExportRowsFromDb(db, { projectId });
		for await (const group of groupSubmissionRows(stream)) {
			yield buildGroupExportRow(group);
		}
	}

	return { questions, rows: rows() };
}

async function* toSubmissionExportRecords(params: {
	rows: AsyncIterable<SubmissionExportDataRow>;
	options: ExportOptions;
}): AsyncGenerator<SubmissionExportRecord> {
	for await (const row of params.rows) {
		yield buildSubmissionExportRecord({ row, options: params.options });
	}
}

export function createCsvSubmissionExportDataStream(params: {
	questions: ExportQuestionPlan[];
	rows: AsyncIterable<SubmissionExportDataRow>;
	options: ExportOptions;
}): ReadableStream<Uint8Array> {
	const headers = buildSubmissionExportHeaders(
		params.questions,
		params.options,
	);

	return createCsvSubmissionExportStream({
		headers,
		rows: toSubmissionExportRecords({
			rows: params.rows,
			options: params.options,
		}),
	});
}

export function createCsvSubmissionExportStream(exportData: {
	headers: string[];
	rows: AsyncIterable<SubmissionExportRecord>;
}): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			const stringifier = stringify({
				header: true,
				columns: exportData.headers,
				cast: { boolean: (value: boolean) => String(value) },
			});

			stringifier.on("data", (chunk: string | Buffer) => {
				if (typeof chunk === "string") {
					controller.enqueue(encoder.encode(chunk));
					return;
				}

				controller.enqueue(new Uint8Array(chunk));
			});

			stringifier.on("end", () => {
				controller.close();
			});

			stringifier.on("error", (error) => {
				controller.error(error);
			});

			try {
				for await (const row of exportData.rows) {
					if (!stringifier.write(row)) {
						await once(stringifier, "drain");
					}
				}

				stringifier.end();
			} catch (error) {
				const streamError =
					error instanceof Error
						? error
						: new Error("Failed to stream submission CSV.");
				stringifier.destroy(streamError);
			}
		},
	});
}

export async function createCsvSubmissionExport(
	options: ExportOptions,
	projectId: string,
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<ReadableStream<Uint8Array>> {
	const exportData = await createSubmissionExport(projectId, { db });
	return createCsvSubmissionExportDataStream({
		questions: exportData.questions,
		rows: exportData.rows,
		options,
	});
}
