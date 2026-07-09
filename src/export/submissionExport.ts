import "server-only";
import { once } from "node:events";
import { stringify } from "csv-stringify";
import type { Kysely } from "kysely";
import { attachAssessment, markCriterion } from "#criteria/criterion.ts";
import type {
	AssessedCriterion,
	AssessmentCriterionValue,
} from "#criteria/types.ts";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import { loadRubricRowsFromDb, toCriterion } from "#rubrics/rubrics.ts";
import type { SubmissionSubmitter } from "#submissions/types.ts";
import { assertNever } from "#utils/utils.ts";
import {
	buildAssessmentKey,
	buildSubmissionExportHeaders,
	buildSubmissionExportRecord,
	type ExportOptions,
	type ExportRubricPlan,
	type SubmissionExportAssessmentValue,
	type SubmissionExportCriterionData,
	type SubmissionExportDataRow,
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
		.leftJoin("rubric", "rubric.rowId", "assessment.rubricId")
		.leftJoin(
			"criterionAssessment",
			"criterionAssessment.assessmentId",
			"assessment.id",
		)
		.leftJoin("criterion", "criterion.rowId", "criterionAssessment.criterionId")
		.leftJoin(
			"checkCriterionAssessment",
			"checkCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.leftJoin(
			"optionsCriterionAssessment",
			"optionsCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.leftJoin(
			"numberCriterionAssessment",
			"numberCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.select([
			"submission.id as submissionId",
			"submission.type as submissionType",
			"team.name as teamName",
			"student.id as studentId",
			"rubric.id as rubricId",
			"criterion.id as criterionId",
			"checkCriterionAssessment.passed as booleanPassed",
			"optionsCriterionAssessment.selectedLabel as ordinalSelectedLabel",
			"numberCriterionAssessment.score as numericalScore",
		])
		.orderBy("submission.id", "asc")
		.orderBy("assessment.id", "asc")
		.orderBy("criterionAssessment.id", "asc")
		.stream(200);
}

export async function createSubmissionExport(
	projectId: string,
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{
	rubrics: ExportRubricPlan[];
	rows: AsyncGenerator<SubmissionExportDataRow>;
}> {
	await assertSubmissionInvariantsFromDb(db, { projectId });

	const rubricRows = await loadRubricRowsFromDb(db, { projectId });
	const rubrics: ExportRubricPlan[] = rubricRows.map((row) => ({
		id: row.id,
		criteria: row.criteria.map(toCriterion),
	}));

	function getAssessmentValue(
		criterion: AssessedCriterion,
	): SubmissionExportAssessmentValue | undefined {
		if (criterion.assessment == null) {
			return undefined;
		}

		switch (criterion.kind) {
			case "check": {
				return criterion.assessment.passed;
			}
			case "options": {
				return criterion.assessment.selectedLabel;
			}
			case "number": {
				return criterion.assessment.score;
			}
			default: {
				return assertNever(criterion);
			}
		}
	}

	function buildRubricData(
		valuesByKey: Map<string, AssessmentCriterionValue>,
	): SubmissionExportRubricData[] {
		return rubrics.map((rubric) => ({
			rubricId: rubric.id,
			criteria: rubric.criteria.map((criterion) => {
				const assessedCriterion = attachAssessment(
					criterion,
					valuesByKey.get(buildAssessmentKey(rubric.id, criterion.id)),
				);

				const rowCriterion: SubmissionExportCriterionData = {
					criterionId: criterion.id,
				};

				const assessment = getAssessmentValue(assessedCriterion);
				if (assessment != null) {
					rowCriterion.assessment = assessment;
				}

				if (assessedCriterion.assessment != null) {
					rowCriterion.marks = markCriterion(assessedCriterion);
				}

				return rowCriterion;
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
			rubrics: buildRubricData(group.valuesByKey),
		};
	}

	async function* rows(): AsyncGenerator<SubmissionExportDataRow> {
		const stream = streamSubmissionExportRowsFromDb(db, { projectId });
		for await (const group of groupSubmissionRows(stream)) {
			yield buildGroupExportRow(group);
		}
	}

	return { rubrics, rows: rows() };
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
	rubrics: ExportRubricPlan[];
	rows: AsyncIterable<SubmissionExportDataRow>;
	options: ExportOptions;
}): ReadableStream<Uint8Array> {
	const headers = buildSubmissionExportHeaders(params.rubrics, params.options);

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
		rubrics: exportData.rubrics,
		rows: exportData.rows,
		options,
	});
}
